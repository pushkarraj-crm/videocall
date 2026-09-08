import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConsentDocumentType,
  HostApplicationStatus,
  HostEarningStatus,
  KycVerificationStatus,
  Role,
  WalletTransactionType,
  WithdrawalStatus,
} from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import {
  getInrPerCoin,
  resolveCoinsPerMinuteUnits,
  unitsToCoinsPerMinute,
  unitsToMonetary,
} from '../../common/utils/coin-pricing';
import { hostCoinsToInr, hostUnitsToInr } from '../../common/utils/host-inr';
import {
  isValidUpiId,
  validateWithdrawalAmount,
  withdrawalDisplayStatus,
} from '../../common/utils/withdrawal-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import {
  batchFollowerCounts,
  batchFollowingSet,
} from '../../common/utils/follow-batch';
import { serializeHostProfile } from '../../common/utils/serialize-host-profile';
import {
  canReceiveCalls,
  formatLastSeenLabel,
  resolveHostStatus,
} from '../../common/utils/host-status';
import {
  heartbeatStaleCutoff,
  HOST_HEARTBEAT_INTERVAL_MS,
  isHeartbeatFresh,
} from '../../common/utils/host-heartbeat';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { KycService } from '../kyc/kyc.service';
import { WalletService } from '../wallet/wallet.service';
import { VirtualHostsService } from '../virtual-hosts/virtual-hosts.service';
import { buildDiscoverSortScore } from '../../common/utils/virtual-host';
import { AddBankAccountDto } from './dto/add-bank-account.dto';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';

const PENDING_WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.requested,
  WithdrawalStatus.approved,
  WithdrawalStatus.processing,
];

@Injectable()
export class HostsService {
  private readonly logger = new Logger(HostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationDispatcherService,
    private readonly kycService: KycService,
    private readonly virtualHosts: VirtualHostsService,
  ) {}

  async applyForHost(userId: string) {
    this.logger.log(`Host apply started userId=${userId}`);

    await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true },
    });

    await this.ensureHostAgreementConsent(userId);
    await this.approveHostInstantly(userId);

    const [application, roles] = await Promise.all([
      this.prisma.hostApplication.findUniqueOrThrow({ where: { userId } }),
      this.usersService.getUserRoles(userId),
    ]);

    this.logger.log(
      `Host apply complete userId=${userId} status=${application.status} roles=${roles.join(',')}`,
    );

    return { ...application, instant: true };
  }

  private async ensureHostAgreementConsent(userId: string) {
    const hasConsent = await this.prisma.userConsent.findFirst({
      where: { userId, documentType: ConsentDocumentType.host_agreement },
    });
    if (!hasConsent) {
      await this.prisma.userConsent.create({
        data: {
          userId,
          documentType: ConsentDocumentType.host_agreement,
          documentVersion: '1.0',
        },
      });
    }
  }

  private async approveHostInstantly(userId: string) {
    await this.usersService.assignRole(userId, Role.host);
    await this.prisma.hostApplication.upsert({
      where: { userId },
      update: {
        status: HostApplicationStatus.approved,
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedById: null,
      },
      create: {
        userId,
        status: HostApplicationStatus.approved,
        reviewedAt: new Date(),
      },
    });
    await this.prisma.hostProfile.upsert({
      where: { userId },
      create: { userId, approvedAt: new Date() },
      update: { approvedAt: new Date() },
    });
  }

  async getApplicationStatus(userId: string) {
    const [application, roles] = await Promise.all([
      this.prisma.hostApplication.findUnique({ where: { userId } }),
      this.usersService.getUserRoles(userId),
    ]);

    if (!application) {
      return {
        userId,
        status: null,
        isHost: roles.includes(Role.host),
        canAccessDashboard: roles.includes(Role.host),
      };
    }

    const isApproved =
      application.status === HostApplicationStatus.approved && roles.includes(Role.host);

    return {
      userId,
      status: application.status,
      rejectionReason: application.rejectionReason,
      reviewedAt: application.reviewedAt,
      createdAt: application.createdAt,
      isHost: roles.includes(Role.host),
      canAccessDashboard: isApproved,
    };
  }

  private parseLanguagesFromBio(bio: string | null, primaryLanguage: string | null): string[] {
    if (bio?.includes('Languages:')) {
      const part = bio.split('Languages:')[1]?.trim() ?? '';
      const langs = part
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      if (langs.length > 0) return langs;
    }
    if (primaryLanguage) return [primaryLanguage];
    return [];
  }

  async setAvailability(userId: string, isAvailable: boolean) {
    return this.setHostStatus(userId, isAvailable ? 'ONLINE' : 'OFFLINE');
  }

  async getHostStatus(userId: string) {
    const roles = await this.usersService.getUserRoles(userId);
    if (!roles.includes(Role.host)) {
      throw new BusinessException('Host role required', 403, 'NOT_A_HOST');
    }

    const profile = await this.prisma.hostProfile.findUniqueOrThrow({
      where: { userId },
      include: { hostHeartbeat: true },
    });

    return this.serializeHostAvailability(profile, profile.hostHeartbeat?.lastBeatAt);
  }

  async setHostStatus(userId: string, status: 'ONLINE' | 'OFFLINE') {
    const roles = await this.usersService.getUserRoles(userId);
    if (!roles.includes(Role.host)) {
      throw new BusinessException('Host role required', 403, 'NOT_A_HOST');
    }

    const current = await this.prisma.hostProfile.findUniqueOrThrow({
      where: { userId },
    });

    if (current.profileType !== 'REAL_HOST') {
      throw new BusinessException(
        'Virtual hosts are managed from admin panel',
        403,
        'VIRTUAL_HOST_STATUS_LOCKED',
      );
    }

    if (current.isBusy) {
      throw new BusinessException('Cannot change status during an active call', 409, 'HOST_BUSY');
    }

    const now = new Date();
    const profile = await this.prisma.hostProfile.update({
      where: { userId },
      data:
        status === 'ONLINE'
          ? {
              isOnline: true,
              isBusy: false,
              isAvailable: true,
            }
          : {
              isOnline: false,
              isBusy: false,
              isAvailable: false,
              lastSeenAt: now,
            },
    });

    const heartbeat =
      status === 'ONLINE' ? await this.touchHeartbeat(userId, now) : null;

    return this.serializeHostAvailability(profile, heartbeat?.lastBeatAt);
  }

  async recordHeartbeat(userId: string) {
    const roles = await this.usersService.getUserRoles(userId);
    if (!roles.includes(Role.host)) {
      throw new BusinessException('Host role required', 403, 'NOT_A_HOST');
    }

    const profile = await this.prisma.hostProfile.findUniqueOrThrow({
      where: { userId },
    });

    if (profile.profileType !== 'REAL_HOST') {
      throw new BusinessException('Heartbeat only applies to real hosts', 403, 'VIRTUAL_HOST');
    }

    if (!profile.isOnline || profile.isBusy) {
      throw new BusinessException('Host must be online and available', 409, 'HOST_NOT_ONLINE');
    }

    const beat = await this.touchHeartbeat(userId);
    return {
      userId,
      lastBeatAt: beat.lastBeatAt,
      nextBeatInMs: HOST_HEARTBEAT_INTERVAL_MS,
    };
  }

  async sweepStaleHeartbeats() {
    const cutoff = heartbeatStaleCutoff();
    const stale = await this.prisma.hostProfile.findMany({
      where: {
        profileType: 'REAL_HOST',
        isOnline: true,
        isBusy: false,
        OR: [
          { hostHeartbeat: null },
          { hostHeartbeat: { lastBeatAt: { lt: cutoff } } },
        ],
      },
      select: { userId: true },
    });

    if (stale.length === 0) {
      return { markedOffline: 0 };
    }

    const now = new Date();
    await this.prisma.hostProfile.updateMany({
      where: { userId: { in: stale.map((h) => h.userId) } },
      data: { isOnline: false, isBusy: false, isAvailable: false, lastSeenAt: now },
    });

    return { markedOffline: stale.length };
  }

  private async touchHeartbeat(userId: string, at = new Date()) {
    return this.prisma.hostHeartbeat.upsert({
      where: { userId },
      create: { userId, lastBeatAt: at },
      update: { lastBeatAt: at },
    });
  }

  private serializeHostAvailability(
    profile: {
      userId: string;
      isOnline: boolean;
      isBusy: boolean;
      isAvailable: boolean;
      lastSeenAt: Date | null;
    },
    lastBeatAt?: Date | null,
  ) {
    const heartbeatFresh = isHeartbeatFresh(lastBeatAt);
    const effectivelyOnline = profile.isOnline && heartbeatFresh;
    const status = resolveHostStatus(effectivelyOnline, profile.isBusy);
    return {
      hostId: profile.userId,
      isOnline: profile.isOnline,
      isBusy: profile.isBusy,
      isAvailable: profile.isAvailable,
      heartbeatFresh,
      lastBeatAt: lastBeatAt ?? null,
      status,
      lastSeenAt: profile.lastSeenAt,
      lastSeenLabel: formatLastSeenLabel(profile.lastSeenAt, effectivelyOnline, profile.isBusy),
      canReceiveCalls: canReceiveCalls(effectivelyOnline, profile.isBusy),
      nextHeartbeatInMs: profile.isOnline && !profile.isBusy ? HOST_HEARTBEAT_INTERVAL_MS : null,
    };
  }

  async getDashboard(userId: string) {
    const profile = await this.prisma.hostProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BusinessException('Host profile not found', 404, 'HOST_NOT_FOUND');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, avatarUrl: true, bio: true },
    });

    const recentEarnings = await this.prisma.hostEarning.findMany({
      where: { hostId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const galleryRaw = profile.virtualHostGallery;
    const galleryUrls = Array.isArray(galleryRaw)
      ? galleryRaw
          .map((item) =>
            item && typeof item === 'object' && 'url' in item && typeof (item as { url: unknown }).url === 'string'
              ? (item as { url: string }).url
              : typeof item === 'string'
                ? item
                : null,
          )
          .filter((u): u is string => !!u)
      : [];

    return {
      profile: {
        ...serializeHostProfile(profile),
        displayName: user?.displayName ?? 'Host',
        avatarUrl: user?.avatarUrl ?? null,
        bio: user?.bio ?? null,
        gallery: galleryUrls,
      },
      recentEarnings: recentEarnings.map((e) => this.serializeEarning(e)),
    };
  }

  async getEarningsSummary(userId: string) {
    const profile = await this.prisma.hostProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BusinessException('Host profile not found', 404, 'HOST_NOT_FOUND');
    }

    const platformFeePercent = this.config.get<number>('PLATFORM_FEE_PERCENT', 30);
    const inrPerCoin = await getInrPerCoin(this.prisma);

    const [
      giftAgg,
      callAgg,
      heldAgg,
      pendingWithdrawalAgg,
      completedWithdrawalAgg,
      recentEarnings,
      withdrawals,
    ] = await Promise.all([
      this.prisma.hostEarning.aggregate({
        where: { hostId: userId, billingTickId: null },
        _sum: { netUnits: true },
      }),
      this.prisma.hostEarning.aggregate({
        where: { hostId: userId, billingTickId: { not: null } },
        _sum: { netUnits: true, grossUnits: true, platformFeeUnits: true },
      }),
      this.prisma.hostEarning.aggregate({
        where: { hostId: userId, status: HostEarningStatus.held },
        _sum: { netUnits: true, grossUnits: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { hostId: userId, status: { in: PENDING_WITHDRAWAL_STATUSES } },
        _sum: { amountUnits: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { hostId: userId, status: WithdrawalStatus.completed },
        _sum: { amountUnits: true },
      }),
      this.prisma.hostEarning.findMany({
        where: { hostId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.withdrawal.findMany({
        where: { hostId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const giftUnits = giftAgg._sum.netUnits ?? 0n;
    const callUnits = callAgg._sum.netUnits ?? 0n;
    const heldNetUnits = heldAgg._sum.netUnits ?? 0n;
    const heldGrossUnits = heldAgg._sum.grossUnits ?? 0n;
    const pendingWithdrawalUnits = pendingWithdrawalAgg._sum.amountUnits ?? 0n;
    const completedWithdrawalUnits = completedWithdrawalAgg._sum.amountUnits ?? 0n;

    const totalEarnedCoins = unitsToCoins(profile.totalEarningsUnits);
    const withdrawableCoins = unitsToCoins(profile.withdrawableUnits);
    const pendingBalanceCoins = unitsToCoins(heldNetUnits);
    const totalMinutes = Math.floor(Number(profile.totalCallSeconds) / 60);
    const callGrossMonetary = unitsToMonetary(
      callAgg._sum.grossUnits ?? 0n,
      inrPerCoin,
      platformFeePercent,
    );

    return {
      totalEarnedUnits: profile.totalEarningsUnits.toString(),
      totalEarnedCoins,
      totalEarnedInr: hostCoinsToInr(totalEarnedCoins),
      availableBalanceUnits: profile.withdrawableUnits.toString(),
      availableBalanceCoins: withdrawableCoins,
      availableBalanceInr: hostUnitsToInr(profile.withdrawableUnits),
      pendingBalanceUnits: heldNetUnits.toString(),
      pendingBalanceCoins,
      pendingBalanceInr: unitsToMonetary(heldGrossUnits, inrPerCoin, platformFeePercent).hostInr,
      totalCalls: profile.totalCalls,
      totalMinutes,
      platformFeePercent,
      inrPerCoin: Math.round(inrPerCoin * 100) / 100,
      giftEarningsUnits: giftUnits.toString(),
      giftEarningsCoins: unitsToCoins(giftUnits),
      giftEarningsInr: hostCoinsToInr(unitsToCoins(giftUnits)),
      callEarningsUnits: callUnits.toString(),
      callEarningsCoins: unitsToCoins(callUnits),
      callEarningsInr: callGrossMonetary.hostInr,
      withdrawableUnits: profile.withdrawableUnits.toString(),
      withdrawableCoins,
      withdrawableInr: hostUnitsToInr(profile.withdrawableUnits),
      pendingWithdrawalUnits: pendingWithdrawalUnits.toString(),
      pendingWithdrawalCoins: unitsToCoins(pendingWithdrawalUnits),
      pendingWithdrawalInr: hostUnitsToInr(pendingWithdrawalUnits),
      completedWithdrawalUnits: completedWithdrawalUnits.toString(),
      completedWithdrawalCoins: unitsToCoins(completedWithdrawalUnits),
      completedWithdrawalInr: hostUnitsToInr(completedWithdrawalUnits),
      recentEarnings: recentEarnings.map((e) => this.serializeEarning(e, inrPerCoin, platformFeePercent)),
      withdrawals: withdrawals.map((w) => this.serializeWithdrawal(w)),
    };
  }

  async listEarningsHistory(userId: string, page = 1, limit = 20) {
    const profile = await this.prisma.hostProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BusinessException('Host profile not found', 404, 'HOST_NOT_FOUND');
    }

    const platformFeePercent = this.config.get<number>('PLATFORM_FEE_PERCENT', 30);
    const inrPerCoin = await getInrPerCoin(this.prisma);

    const callEarnings = await this.prisma.hostEarning.findMany({
      where: { hostId: userId, billingTickId: { not: null } },
      include: {
        call: {
          select: {
            id: true,
            durationSeconds: true,
            coinsChargedUnits: true,
            isFreeCall: true,
            endedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const grouped = new Map<
      string,
      {
        callId: string;
        date: Date;
        minutes: number;
        coins: number;
        grossUnits: bigint;
        platformFeeUnits: bigint;
        hostUnits: bigint;
        status: HostEarningStatus;
        isFreeCall: boolean;
      }
    >();

    for (const earning of callEarnings) {
      const existing = grouped.get(earning.callId);
      const minutes = Math.max(1, Math.round(earning.call.durationSeconds / 60));

      if (!existing) {
        grouped.set(earning.callId, {
          callId: earning.callId,
          date: earning.createdAt,
          minutes,
          coins: unitsToCoins(earning.grossUnits),
          grossUnits: earning.grossUnits,
          platformFeeUnits: earning.platformFeeUnits,
          hostUnits: earning.netUnits,
          status: earning.status,
          isFreeCall: earning.call.isFreeCall,
        });
        continue;
      }

      existing.coins += unitsToCoins(earning.grossUnits);
      existing.grossUnits += earning.grossUnits;
      existing.platformFeeUnits += earning.platformFeeUnits;
      existing.hostUnits += earning.netUnits;
      existing.minutes = minutes;
      if (earning.createdAt > existing.date) existing.date = earning.createdAt;
      if (earning.status === HostEarningStatus.held) existing.status = HostEarningStatus.held;
    }

    const allItems = Array.from(grouped.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
    const skip = (page - 1) * limit;
    const items = allItems.slice(skip, skip + limit).map((row) => {
      const monetary = unitsToMonetary(row.grossUnits, inrPerCoin, platformFeePercent);
      return {
        date: row.date,
        callId: row.callId,
        minutes: row.minutes,
        coins: row.coins,
        grossUnits: row.grossUnits.toString(),
        platformFeeUnits: row.platformFeeUnits.toString(),
        hostUnits: row.hostUnits.toString(),
        grossInr: monetary.grossInr,
        platformFeeInr: monetary.platformFeeInr,
        hostInr: monetary.hostInr,
        status: row.status,
        isFreeCall: row.isFreeCall,
      };
    });

    return {
      items,
      total: allItems.length,
      page,
      limit,
    };
  }

  async listWithdrawals(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { hostId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where: { hostId: userId } }),
    ]);

    return {
      items: items.map((w) => this.serializeWithdrawal(w)),
      total,
      page,
      limit,
    };
  }

  async listBankAccounts(userId: string) {
    const accounts = await this.prisma.hostBankAccount.findMany({
      where: { hostId: userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    return accounts.map((a) => ({
      id: a.id,
      accountHolderName: a.accountHolderName,
      accountNumberMasked: a.accountNumberMasked,
      ifscCode: a.ifscCode,
      bankName: a.bankName,
      isPrimary: a.isPrimary,
      isVerified: a.isVerified,
    }));
  }

  async addBankAccount(userId: string, dto: AddBankAccountDto) {
    const masked = dto.accountNumber.slice(-4).padStart(dto.accountNumber.length, 'X');

    if (dto.isPrimary) {
      await this.prisma.hostBankAccount.updateMany({
        where: { hostId: userId },
        data: { isPrimary: false },
      });
    }

    const autoVerify =
      this.config.get<string>('NODE_ENV') !== 'production' ||
      this.config.get<string>('ENABLE_DEV_AUTH') === 'true';

    return this.prisma.hostBankAccount.create({
      data: {
        hostId: userId,
        accountHolderName: dto.accountHolderName,
        accountNumberEnc: this.encryptPlaceholder(dto.accountNumber),
        accountNumberMasked: masked,
        ifscCode: dto.ifscCode.toUpperCase(),
        bankName: dto.bankName,
        upiIdEnc: dto.upiId ? this.encryptPlaceholder(dto.upiId) : null,
        isPrimary: dto.isPrimary ?? false,
        isVerified: autoVerify,
      },
    });
  }

  async requestWithdrawal(userId: string, dto: RequestWithdrawalDto) {
    const hostProfile = await this.prisma.hostProfile.findUnique({
      where: { userId },
      select: { adminWithdrawalsDisabled: true },
    });
    if (hostProfile?.adminWithdrawalsDisabled) {
      throw new BusinessException('Withdrawals are disabled for this host', 403, 'WITHDRAWALS_DISABLED');
    }

    const kycVerified = await this.kycService.isHostKycVerified(userId);
    if (!kycVerified) {
      throw new BusinessException(
        'KYC verification required before withdrawal',
        403,
        'KYC_REQUIRED',
      );
    }

    const minUnits = BigInt(this.config.get<number>('WITHDRAWAL_MIN_UNITS', 50000) ?? 50000);
    const amountUnits = BigInt(dto.amountUnits);
    const usesUpi = Boolean(dto.upiId?.trim());
    const usesBank = Boolean(dto.bankAccountId);

    if (usesUpi === usesBank) {
      throw new BusinessException(
        'Provide either UPI details or a verified bank account',
        400,
        'INVALID_PAYOUT_METHOD',
      );
    }

    try {
      const profile = await this.prisma.hostProfile.findUniqueOrThrow({
        where: { userId },
      });
      validateWithdrawalAmount({
        amountUnits,
        withdrawableUnits: profile.withdrawableUnits,
        minUnits,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid withdrawal amount';
      if (message.includes('minimum')) {
        throw new BusinessException('Below minimum withdrawal', 400, 'MIN_WITHDRAWAL');
      }
      if (message.includes('Insufficient')) {
        throw new BusinessException('Insufficient withdrawable balance', 400, 'INSUFFICIENT_EARNINGS');
      }
      throw new BusinessException(message, 400, 'INVALID_WITHDRAWAL_AMOUNT');
    }

    let bankAccountId: string | null = null;
    let upiId: string | null = null;
    let accountHolderName: string | null = null;

    if (usesBank) {
      const bankAccount = await this.prisma.hostBankAccount.findFirst({
        where: { id: dto.bankAccountId, hostId: userId, isVerified: true },
      });

      if (!bankAccount) {
        throw new BusinessException('Verified bank account required', 400, 'BANK_NOT_VERIFIED');
      }

      bankAccountId = bankAccount.id;
      accountHolderName = bankAccount.accountHolderName;
    } else {
      const normalizedUpi = dto.upiId!.trim().toLowerCase();
      const holderName = dto.accountHolderName?.trim() ?? '';

      if (!isValidUpiId(normalizedUpi)) {
        throw new BusinessException('Invalid UPI ID', 400, 'INVALID_UPI');
      }
      if (!holderName) {
        throw new BusinessException('Account holder name is required', 400, 'INVALID_ACCOUNT_NAME');
      }

      upiId = normalizedUpi;
      accountHolderName = holderName;
    }

    const pendingExisting = await this.prisma.withdrawal.findFirst({
      where: {
        hostId: userId,
        status: { in: PENDING_WITHDRAWAL_STATUSES },
      },
      select: { id: true },
    });
    if (pendingExisting) {
      throw new BusinessException(
        'You already have a pending withdrawal request',
        409,
        'PENDING_WITHDRAWAL_EXISTS',
      );
    }

    const amountInr = hostUnitsToInr(amountUnits);
    const payoutKey = bankAccountId ?? upiId ?? 'unknown';
    const idempotencyKey =
      dto.idempotencyKey ?? `withdrawal:${userId}:${payoutKey}:${amountUnits}:${Date.now()}`;

    const existing = await this.prisma.withdrawal.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return this.serializeWithdrawal(existing);
    }

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const updatedProfile = await tx.hostProfile.update({
        where: { userId },
        data: { withdrawableUnits: { decrement: amountUnits } },
      });

      if (updatedProfile.withdrawableUnits < 0n) {
        throw new BusinessException('Insufficient withdrawable balance', 400, 'INSUFFICIENT_EARNINGS');
      }

      return tx.withdrawal.create({
        data: {
          hostId: userId,
          bankAccountId,
          upiId,
          accountHolderName,
          amountUnits,
          amountInr,
          netInr: amountInr,
          status: WithdrawalStatus.requested,
          idempotencyKey,
        },
      });
    });

    await this.wallet.recordLedgerEntry({
      userId,
      amountUnits: -amountUnits,
      type: WalletTransactionType.withdrawal,
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
      idempotencyKey: `ledger:withdrawal:${withdrawal.id}`,
      description: 'Withdrawal request',
    });

    this.notifications.dispatchSafe(
      this.notifications.onWithdrawalRequested(
        withdrawal.id,
        userId,
        String(withdrawal.amountInr),
      ),
      `withdrawal_requested/${withdrawal.id}`,
    );

    return this.serializeWithdrawal(withdrawal);
  }

  async browseHosts(page = 1, limit = 20, viewerId?: string) {
    const skip = (page - 1) * limit;
    const where = this.virtualHosts.buildDiscoverWhere();

    const [allHosts, total] = await Promise.all([
      this.prisma.hostProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              gender: true,
              primaryLanguage: true,
              dateOfBirth: true,
            },
          },
        },
      }),
      this.prisma.hostProfile.count({ where }),
    ]);

    const discoverable = allHosts
      .filter((h) => this.virtualHosts.isDiscoverable(h))
      .sort((a, b) => buildDiscoverSortScore(b) - buildDiscoverSortScore(a));

    const hosts = discoverable.slice(skip, skip + limit);

    const hostIds = hosts.map((h) => h.userId);
    const verifiedKyc = hostIds.length
      ? await this.prisma.hostKyc.findMany({
          where: {
            userId: { in: hostIds },
            verificationStatus: KycVerificationStatus.verified,
          },
          select: { userId: true },
          distinct: ['userId'],
        })
      : [];
    const verifiedSet = new Set(verifiedKyc.map((k) => k.userId));

    const [followerCounts, followingSet] = await Promise.all([
      batchFollowerCounts(this.prisma, hostIds),
      viewerId ? batchFollowingSet(this.prisma, viewerId, hostIds) : Promise.resolve(new Set<string>()),
    ]);

    return {
      hosts: hosts.map((host) => {
        const status = resolveHostStatus(host.isOnline, host.isBusy);
        const receivable = canReceiveCalls(host.isOnline, host.isBusy);
        return {
          userId: host.userId,
          isAvailable: receivable,
          isOnline: host.isOnline,
          isBusy: host.isBusy,
          status,
          lastSeenAt: host.lastSeenAt,
          lastSeenLabel: formatLastSeenLabel(host.lastSeenAt, host.isOnline, host.isBusy),
          canReceiveCalls: receivable,
          totalCalls: host.totalCalls,
          rating:
            host.ratingCount > 0 ? host.ratingSum / host.ratingCount : null,
          reviewCount: host.ratingCount,
          followerCount: followerCounts.get(host.userId) ?? 0,
          isFollowing: viewerId ? followingSet.has(host.userId) : false,
          isVerified: verifiedSet.has(host.userId),
          coinsPerMinute: unitsToCoinsPerMinute(
            resolveCoinsPerMinuteUnits(host.coinsPerMinuteUnits, this.config),
          ),
          isAiHost: host.profileType === 'AI_HOST' || host.profileType === 'MANAGED_HOST',
          ...this.virtualHosts.serializeForDiscover(host),
          user: host.user,
        };
      }),
      total: discoverable.length,
      page,
      limit,
    };
  }

  private serializeEarning(
    e: {
      id: string;
      hostId: string;
      callId: string;
      billingTickId: string | null;
      status: string;
      availableAt: Date;
      createdAt: Date;
      grossUnits: bigint;
      platformFeeUnits: bigint;
      netUnits: bigint;
    },
    inrPerCoin = 1,
    platformFeePercent = 30,
  ) {
    const monetary = unitsToMonetary(e.grossUnits, inrPerCoin, platformFeePercent);
    return {
      id: e.id,
      hostId: e.hostId,
      callId: e.callId,
      billingTickId: e.billingTickId,
      type: e.billingTickId ? 'call_earning' : 'gift_receive',
      status: e.status,
      availableAt: e.availableAt,
      createdAt: e.createdAt,
      grossUnits: e.grossUnits.toString(),
      platformFeeUnits: e.platformFeeUnits.toString(),
      netUnits: e.netUnits.toString(),
      netCoins: unitsToCoins(e.netUnits),
      netInr: hostUnitsToInr(e.netUnits),
      grossInr: monetary.grossInr,
      platformFeeInr: monetary.platformFeeInr,
      hostInr: monetary.hostInr,
    };
  }

  private serializeWithdrawal(w: {
    id: string;
    amountUnits: bigint;
    amountInr: { toString(): string };
    netInr: { toString(): string };
    status: WithdrawalStatus;
    upiId?: string | null;
    accountHolderName?: string | null;
    rejectionReason: string | null;
    adminNote?: string | null;
    approvedAt: Date | null;
    processedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: w.id,
      amountUnits: w.amountUnits.toString(),
      amountCoins: unitsToCoins(w.amountUnits),
      amountInr: w.amountInr.toString(),
      netInr: w.netInr.toString(),
      status: w.status,
      displayStatus: withdrawalDisplayStatus(w.status),
      upiId: w.upiId ?? null,
      accountHolderName: w.accountHolderName ?? null,
      rejectionReason: w.rejectionReason,
      adminNote: w.adminNote ?? null,
      approvedAt: w.approvedAt,
      processedAt: w.processedAt,
      createdAt: w.createdAt,
    };
  }

  private encryptPlaceholder(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}