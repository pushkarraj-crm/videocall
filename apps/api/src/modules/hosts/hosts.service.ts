import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConsentDocumentType,
  HostApplicationStatus,
  Role,
  WithdrawalStatus,
} from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AddBankAccountDto } from './dto/add-bank-account.dto';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';

@Injectable()
export class HostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async applyForHost(userId: string) {
    const existing = await this.prisma.hostApplication.findUnique({
      where: { userId },
    });

    if (existing && existing.status !== HostApplicationStatus.rejected) {
      throw new BusinessException('Application already exists', 400, 'APPLICATION_EXISTS');
    }

    const application = await this.prisma.hostApplication.upsert({
      where: { userId },
      update: { status: HostApplicationStatus.pending, rejectionReason: null },
      create: { userId, status: HostApplicationStatus.pending },
    });

    await this.prisma.userConsent.create({
      data: {
        userId,
        documentType: ConsentDocumentType.host_agreement,
        documentVersion: '1.0',
      },
    });

    return application;
  }

  async setAvailability(userId: string, isAvailable: boolean) {
    const roles = await this.usersService.getUserRoles(userId);
    if (!roles.includes(Role.host)) {
      throw new BusinessException('Host role required', 403, 'NOT_A_HOST');
    }

    return this.prisma.hostProfile.update({
      where: { userId },
      data: { isAvailable },
    });
  }

  async getDashboard(userId: string) {
    const profile = await this.prisma.hostProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BusinessException('Host profile not found', 404, 'HOST_NOT_FOUND');
    }

    const recentEarnings = await this.prisma.hostEarning.findMany({
      where: { hostId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      profile: {
        userId: profile.userId,
        isAvailable: profile.isAvailable,
        hostBio: profile.hostBio,
        languages: profile.languages,
        totalCalls: profile.totalCalls,
        ratingSum: profile.ratingSum,
        ratingCount: profile.ratingCount,
        approvedAt: profile.approvedAt,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        totalEarningsUnits: profile.totalEarningsUnits.toString(),
        withdrawableUnits: profile.withdrawableUnits.toString(),
        totalCallSeconds: profile.totalCallSeconds.toString(),
        totalEarningsCoins: unitsToCoins(profile.totalEarningsUnits),
        withdrawableCoins: unitsToCoins(profile.withdrawableUnits),
        rating:
          profile.ratingCount > 0
            ? profile.ratingSum / profile.ratingCount
            : null,
      },
      recentEarnings: recentEarnings.map((e) => ({
        id: e.id,
        hostId: e.hostId,
        callId: e.callId,
        billingTickId: e.billingTickId,
        status: e.status,
        availableAt: e.availableAt,
        createdAt: e.createdAt,
        grossUnits: e.grossUnits.toString(),
        platformFeeUnits: e.platformFeeUnits.toString(),
        netUnits: e.netUnits.toString(),
      })),
    };
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
    const minUnits = BigInt(this.config.get<number>('WITHDRAWAL_MIN_UNITS', 50000) ?? 50000);
    const amountUnits = BigInt(dto.amountUnits);

    if (amountUnits < minUnits) {
      throw new BusinessException('Below minimum withdrawal', 400, 'MIN_WITHDRAWAL');
    }

    const profile = await this.prisma.hostProfile.findUniqueOrThrow({
      where: { userId },
    });

    if (profile.withdrawableUnits < amountUnits) {
      throw new BusinessException('Insufficient withdrawable balance', 400, 'INSUFFICIENT_EARNINGS');
    }

    const bankAccount = await this.prisma.hostBankAccount.findFirst({
      where: { id: dto.bankAccountId, hostId: userId, isVerified: true },
    });

    if (!bankAccount) {
      throw new BusinessException('Verified bank account required', 400, 'BANK_NOT_VERIFIED');
    }

    const hostSharePercent = this.config.get<number>('PLATFORM_FEE_PERCENT', 30);
    const hostPercent = 100 - hostSharePercent;
    const amountInr = (Number(amountUnits) / hostPercent) * 10 * 0.7;

    return this.prisma.$transaction(async (tx) => {
      await tx.hostProfile.update({
        where: { userId },
        data: { withdrawableUnits: { decrement: amountUnits } },
      });

      return tx.withdrawal.create({
        data: {
          hostId: userId,
          bankAccountId: dto.bankAccountId,
          amountUnits,
          amountInr,
          netInr: amountInr,
          status: WithdrawalStatus.requested,
          idempotencyKey: `withdrawal:${userId}:${Date.now()}`,
        },
      });
    });
  }

  async browseHosts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [hosts, total] = await Promise.all([
      this.prisma.hostProfile.findMany({
        where: { isAvailable: true },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              gender: true,
              primaryLanguage: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.hostProfile.count({ where: { isAvailable: true } }),
    ]);

    return {
      hosts: hosts.map((host) => ({
        userId: host.userId,
        isAvailable: host.isAvailable,
        totalCalls: host.totalCalls,
        rating:
          host.ratingCount > 0 ? host.ratingSum / host.ratingCount : null,
        user: host.user,
      })),
      total,
      page,
      limit,
    };
  }

  private encryptPlaceholder(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}