import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CallHistoryStatus,
  PaymentStatus,
  Prisma,
  ReferralStatus,
  WalletTransactionType,
} from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { getReferralProgramConfig } from '../../common/utils/referral-config';
import {
  REFERRAL_USER_SELECT,
  serializeReferral,
} from '../../common/utils/referral-display';
import { assessReferralFraud } from '../../common/utils/referral-fraud';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { WalletService } from '../wallet/wallet.service';

export interface ApplyReferralMeta {
  ip?: string;
  deviceFingerprint?: string;
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  async applyReferralCode(
    referredUserId: string,
    referralCode: string,
    meta?: ApplyReferralMeta,
  ) {
    const program = await this.getConfig();

    if (!program.enabled) {
      throw new BusinessException('Referral program is disabled', 403, 'REFERRAL_DISABLED');
    }

    const normalizedCode = referralCode.trim().toUpperCase();

    const [referrer, referred] = await Promise.all([
      this.prisma.user.findFirst({
        where: { referralCode: normalizedCode, deletedAt: null },
        select: {
          id: true,
          phone: true,
          email: true,
          authIdentity: true,
          deviceFingerprint: true,
        },
      }),
      this.prisma.user.findFirst({
        where: { id: referredUserId, deletedAt: null },
        select: {
          id: true,
          phone: true,
          email: true,
          authIdentity: true,
          deviceFingerprint: true,
          referredById: true,
        },
      }),
    ]);

    if (!referrer) {
      throw new BusinessException('Invalid referral code', 400, 'INVALID_REFERRAL_CODE');
    }

    if (!referred) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }

    if (referrer.id === referredUserId) {
      throw new BusinessException('Cannot use your own referral code', 400, 'SELF_REFERRAL');
    }

    const existing = await this.prisma.referral.findUnique({
      where: { referredId: referredUserId },
    });

    if (existing) {
      throw new BusinessException('Referral already applied', 400, 'REFERRAL_EXISTS');
    }

    const fraud = await assessReferralFraud(this.prisma, referrer, referred, meta);
    if (fraud.block) {
      throw new BusinessException('Referral blocked by fraud checks', 403, 'REFERRAL_FRAUD');
    }

    const holdUntil = new Date(Date.now() + program.holdHours * 60 * 60 * 1000);

    const referral = await this.prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: referredUserId,
        referralCode: normalizedCode,
        referrerRewardUnits: BigInt(program.inviterRewardUnits),
        referredRewardUnits: BigInt(program.invitedRewardUnits),
        holdUntil,
        fraudScore: fraud.score,
        fraudFlags: fraud.flags,
        referredIp: meta?.ip ?? null,
        referredDeviceFingerprint:
          meta?.deviceFingerprint ?? referred.deviceFingerprint ?? null,
      },
    });

    if (!referred.referredById) {
      await this.prisma.user.update({
        where: { id: referredUserId },
        data: { referredById: referrer.id },
      });
    }

    return serializeReferral(referral);
  }

  async qualifyReferral(referredUserId: string, event: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { referredId: referredUserId },
    });

    if (!referral || referral.status !== ReferralStatus.pending) {
      return null;
    }

    const now = new Date();
    const updated = await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.qualified,
        qualificationEvent: event,
        qualifiedAt: now,
        completedAt: now,
      },
    });

    return serializeReferral(updated);
  }

  async processPendingQualifications() {
    const program = await this.getConfig();
    if (!program.enabled) return { qualified: 0 };

    const pending = await this.prisma.referral.findMany({
      where: { status: ReferralStatus.pending },
      take: 100,
    });

    let qualified = 0;
    for (const referral of pending) {
      if (await this.isExpired(referral.createdAt, program.expiryDays)) {
        await this.cancelReferralInternal(referral.id, 'Referral expired');
        continue;
      }

      const met = await this.checkCompletionCondition(
        referral.referredId,
        program.completionRule,
      );
      if (met) {
        await this.qualifyReferral(referral.referredId, met);
        qualified++;
      }
    }

    return { qualified };
  }

  async processPendingRewards() {
    const program = await this.getConfig();
    if (!program.enabled) return { processed: 0 };

    const now = new Date();
    const qualified = await this.prisma.referral.findMany({
      where: {
        status: ReferralStatus.qualified,
        rewardGiven: false,
        OR: [{ holdUntil: null }, { holdUntil: { lte: now } }],
      },
      take: 50,
    });

    let processed = 0;
    for (const referral of qualified) {
      const rewarded = await this.rewardReferral(referral.id, program.maxDailyRewards);
      if (rewarded) processed++;
    }

    return { processed };
  }

  private async rewardReferral(referralId: string, maxDailyRewards: number) {
    const referral = await this.prisma.referral.findUniqueOrThrow({
      where: { id: referralId },
    });

    if (referral.status !== ReferralStatus.qualified || referral.rewardGiven) {
      return false;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRewards = await this.prisma.referral.count({
      where: {
        referrerId: referral.referrerId,
        status: ReferralStatus.rewarded,
        rewardedAt: { gte: todayStart },
      },
    });

    if (todayRewards >= maxDailyRewards) {
      return false;
    }

    await this.wallet.creditWallet({
      userId: referral.referrerId,
      amountUnits: referral.referrerRewardUnits,
      type: WalletTransactionType.referral_bonus,
      referenceType: 'referral',
      referenceId: referral.id,
      idempotencyKey: `referral:referrer:${referral.id}`,
      description: 'Referral bonus',
    });

    await this.wallet.creditWallet({
      userId: referral.referredId,
      amountUnits: referral.referredRewardUnits,
      type: WalletTransactionType.referral_bonus,
      referenceType: 'referral',
      referenceId: referral.id,
      idempotencyKey: `referral:referred:${referral.id}`,
      description: 'Welcome referral bonus',
    });

    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.rewarded,
        rewardGiven: true,
        rewardedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: referral.referrerId,
        action: 'referral.rewarded',
        entityType: 'referral',
        entityId: referral.id,
        newValue: {
          referrerId: referral.referrerId,
          referredId: referral.referredId,
        },
      },
    });

    return true;
  }

  async getMyReferrals(userId: string) {
    const [code, stats] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      }),
      this.prisma.referral.groupBy({
        by: ['status'],
        where: { referrerId: userId },
        _count: true,
      }),
    ]);

    return {
      referralCode: code?.referralCode,
      stats,
    };
  }

  async getReferralDashboard(userId: string) {
    const program = await this.getConfig();
    const [user, sent, received, earnings] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true, displayName: true },
      }),
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { referred: { select: REFERRAL_USER_SELECT } },
      }),
      this.prisma.referral.findUnique({
        where: { referredId: userId },
        include: { referrer: { select: REFERRAL_USER_SELECT } },
      }),
      this.prisma.walletTransaction.aggregate({
        where: {
          userId,
          type: WalletTransactionType.referral_bonus,
          referenceType: 'referral',
        },
        _sum: { amountUnits: true },
      }),
    ]);

    const pending = sent.filter((r) => r.status === ReferralStatus.pending).length;
    const completed = sent.filter((r) => r.status === ReferralStatus.qualified).length;
    const rewarded = sent.filter((r) => r.status === ReferralStatus.rewarded).length;
    const cancelled = sent.filter((r) => r.status === ReferralStatus.rejected).length;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      referralCode: user?.referralCode,
      displayName: user?.displayName,
      program: {
        enabled: program.enabled,
        inviterRewardCoins: unitsToCoins(BigInt(program.inviterRewardUnits)),
        invitedRewardCoins: unitsToCoins(BigInt(program.invitedRewardUnits)),
        completionRule: program.completionRule,
      },
      summary: {
        totalInvites: sent.length,
        pendingInvites: pending,
        successfulInvites: rewarded,
        completedInvites: completed,
        cancelledInvites: cancelled,
        referralEarningsCoins: unitsToCoins(earnings._sum.amountUnits ?? 0n),
        referralsToday: sent.filter((r) => r.createdAt >= todayStart).length,
        referralsThisMonth: sent.filter((r) => r.createdAt >= monthStart).length,
        conversionRate:
          sent.length > 0 ? Math.round((rewarded / sent.length) * 100) : 0,
      },
      invites: sent.map((r) => serializeReferral({ ...r, referred: r.referred })),
      receivedReferral: received
        ? serializeReferral({ ...received, referrer: received.referrer })
        : null,
    };
  }

  async getReferralHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.ReferralWhereInput = {
      OR: [{ referrerId: userId }, { referredId: userId }],
    };

    const [rows, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          referrer: { select: REFERRAL_USER_SELECT },
          referred: { select: REFERRAL_USER_SELECT },
        },
      }),
      this.prisma.referral.count({ where }),
    ]);

    return {
      items: rows.map((r) => serializeReferral(r)),
      total,
      page,
      limit,
    };
  }

  async getHostReferralStats(hostId: string) {
    const dashboard = await this.getReferralDashboard(hostId);
    return {
      referralEarnings: dashboard.summary.referralEarningsCoins,
      referralCount: dashboard.summary.totalInvites,
      referralsToday: dashboard.summary.referralsToday,
      referralsThisMonth: dashboard.summary.referralsThisMonth,
      successfulInvites: dashboard.summary.successfulInvites,
      pendingInvites: dashboard.summary.pendingInvites,
      referralCode: dashboard.referralCode,
    };
  }

  async manualReward(referralId: string, adminId: string) {
    const referral = await this.prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) {
      throw new BusinessException('Referral not found', 404, 'REFERRAL_NOT_FOUND');
    }

    if (referral.rewardGiven) {
      throw new BusinessException('Reward already given', 409, 'REWARD_ALREADY_GIVEN');
    }

    if (referral.status === ReferralStatus.pending) {
      await this.prisma.referral.update({
        where: { id: referralId },
        data: {
          status: ReferralStatus.qualified,
          qualifiedAt: new Date(),
          completedAt: new Date(),
          qualificationEvent: 'admin_manual',
        },
      });
    }

    const program = await this.getConfig();
    const rewarded = await this.rewardReferral(referralId, program.maxDailyRewards);
    if (!rewarded) {
      throw new BusinessException('Could not process reward', 400, 'REWARD_FAILED');
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'referral.manual_reward',
        entityType: 'referral',
        entityId: referralId,
      },
    });

    return this.getReferralById(referralId);
  }

  async cancelReferral(referralId: string, adminId: string, reason?: string) {
    return this.cancelReferralInternal(referralId, reason ?? 'Cancelled by admin', adminId);
  }

  async getReferralById(referralId: string) {
    const row = await this.prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referrer: { select: REFERRAL_USER_SELECT },
        referred: { select: REFERRAL_USER_SELECT },
      },
    });
    if (!row) {
      throw new BusinessException('Referral not found', 404, 'REFERRAL_NOT_FOUND');
    }
    return {
      referral: serializeReferral(row),
      timeline: this.buildTimeline(row),
    };
  }

  private buildTimeline(row: {
    createdAt: Date;
    qualifiedAt: Date | null;
    completedAt: Date | null;
    rewardedAt: Date | null;
    cancelledAt: Date | null;
    qualificationEvent: string | null;
    cancelReason: string | null;
  }) {
    const events: Array<{ at: Date; event: string; detail?: string }> = [
      { at: row.createdAt, event: 'CREATED' },
    ];
    if (row.completedAt || row.qualifiedAt) {
      events.push({
        at: row.completedAt ?? row.qualifiedAt!,
        event: 'COMPLETED',
        detail: row.qualificationEvent ?? undefined,
      });
    }
    if (row.rewardedAt) {
      events.push({ at: row.rewardedAt, event: 'REWARDED' });
    }
    if (row.cancelledAt) {
      events.push({
        at: row.cancelledAt,
        event: 'CANCELLED',
        detail: row.cancelReason ?? undefined,
      });
    }
    return events.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  private async cancelReferralInternal(
    referralId: string,
    reason: string,
    adminId?: string,
  ) {
    const existing = await this.prisma.referral.findUnique({ where: { id: referralId } });
    if (!existing) {
      throw new BusinessException('Referral not found', 404, 'REFERRAL_NOT_FOUND');
    }
    if (existing.status === ReferralStatus.rewarded) {
      throw new BusinessException('Cannot cancel rewarded referral', 400, 'ALREADY_REWARDED');
    }

    const updated = await this.prisma.referral.update({
      where: { id: referralId },
      data: {
        status: ReferralStatus.rejected,
        cancelReason: reason,
        cancelledAt: new Date(),
        adminNote: adminId ? reason : existing.adminNote,
      },
      include: {
        referrer: { select: REFERRAL_USER_SELECT },
        referred: { select: REFERRAL_USER_SELECT },
      },
    });

    if (adminId) {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'referral.cancelled',
          entityType: 'referral',
          entityId: referralId,
          newValue: { reason },
        },
      });
    }

    return serializeReferral(updated);
  }

  private async checkCompletionCondition(
    referredUserId: string,
    rule: 'first_recharge' | 'first_paid_call' | 'either',
  ): Promise<string | null> {
    const [paidRecharge, paidCall] = await Promise.all([
      this.prisma.payment.findFirst({
        where: { userId: referredUserId, status: PaymentStatus.paid },
        select: { id: true },
      }),
      this.prisma.callHistory.findFirst({
        where: {
          callerId: referredUserId,
          status: CallHistoryStatus.completed,
          coinsSpentUnits: { gt: 0 },
        },
        select: { id: true },
      }),
    ]);

    if (rule === 'first_recharge' && paidRecharge) return 'first_recharge';
    if (rule === 'first_paid_call' && paidCall) return 'first_paid_call';
    if (rule === 'either') {
      if (paidRecharge) return 'first_recharge';
      if (paidCall) return 'first_paid_call';
    }
    return null;
  }

  private async isExpired(createdAt: Date, expiryDays: number) {
    const expiry = new Date(createdAt.getTime() + expiryDays * 24 * 60 * 60 * 1000);
    return new Date() > expiry;
  }

  private async getConfig() {
    const envUnits = this.config.get<number>('REFERRAL_REWARD_UNITS', 5000) ?? 5000;
    return getReferralProgramConfig(this.prisma, {
      inviterRewardUnits: envUnits,
      invitedRewardUnits: envUnits,
    });
  }
}