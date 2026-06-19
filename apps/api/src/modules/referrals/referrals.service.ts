import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReferralStatus, WalletTransactionType } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  async applyReferralCode(referredUserId: string, referralCode: string) {
    const referrer = await this.prisma.user.findFirst({
      where: { referralCode, deletedAt: null },
    });

    if (!referrer) {
      throw new BusinessException('Invalid referral code', 400, 'INVALID_REFERRAL_CODE');
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

    const rewardUnits = BigInt(this.config.get<number>('REFERRAL_REWARD_UNITS', 5000));
    const holdHours = 72;

    return this.prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: referredUserId,
        referralCode,
        referrerRewardUnits: rewardUnits,
        referredRewardUnits: rewardUnits,
        holdUntil: new Date(Date.now() + holdHours * 60 * 60 * 1000),
      },
    });
  }

  async qualifyReferral(referredUserId: string, event: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { referredId: referredUserId },
    });

    if (!referral || referral.status !== ReferralStatus.pending) {
      return null;
    }

    return this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.qualified,
        qualificationEvent: event,
        qualifiedAt: new Date(),
      },
    });
  }

  async processPendingRewards() {
    const now = new Date();
    const qualified = await this.prisma.referral.findMany({
      where: {
        status: ReferralStatus.qualified,
        OR: [{ holdUntil: null }, { holdUntil: { lte: now } }],
      },
      take: 50,
    });

    for (const referral of qualified) {
      await this.rewardReferral(referral.id);
    }

    return { processed: qualified.length };
  }

  private async rewardReferral(referralId: string) {
    const referral = await this.prisma.referral.findUniqueOrThrow({
      where: { id: referralId },
    });

    if (referral.status !== ReferralStatus.qualified) return;

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
      data: { status: ReferralStatus.rewarded, rewardedAt: new Date() },
    });
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
}