import { Injectable } from '@nestjs/common';
import {
  FraudFlagStatus,
  FraudFlagType,
  Prisma,
  RiskLevel,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { scoreToRiskLevel } from './utils/risk-score';

@Injectable()
export class RiskActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(
    userId: string,
    eventScore: number,
    eventLevel: RiskLevel,
    geo?: { country?: string; ip?: string },
  ) {
    const existing = await this.prisma.riskUserProfile.findUnique({ where: { userId } });
    const aggregateScore = existing
      ? Math.min(100, Math.round(existing.aggregateScore * 0.6 + eventScore * 0.4))
      : eventScore;
    const riskLevel = scoreToRiskLevel(Math.max(aggregateScore, eventLevel === RiskLevel.critical ? 76 : 0));

    await this.prisma.riskUserProfile.upsert({
      where: { userId },
      create: {
        userId,
        aggregateScore,
        riskLevel,
        lastEventAt: new Date(),
        lastCountry: geo?.country,
        lastIp: geo?.ip,
      },
      update: {
        aggregateScore,
        riskLevel,
        lastEventAt: new Date(),
        ...(geo?.country ? { lastCountry: geo.country } : {}),
        ...(geo?.ip ? { lastIp: geo.ip } : {}),
      },
    });
  }

  async createFlagIfNeeded(
    userId: string,
    type: FraudFlagType,
    ruleId: string,
    score: number,
    reason: string,
  ) {
    const open = await this.prisma.fraudFlag.findFirst({
      where: {
        userId,
        type,
        ruleId,
        status: { in: [FraudFlagStatus.open, FraudFlagStatus.reviewing] },
      },
    });
    if (open) return open;

    return this.prisma.fraudFlag.create({
      data: {
        userId,
        type,
        ruleId,
        riskScore: score,
        reason,
        status: score >= 76 ? FraudFlagStatus.reviewing : FraudFlagStatus.open,
      },
    });
  }

  async applyAutomaticActions(userId: string, level: RiskLevel) {
    if (level !== RiskLevel.critical) return;

    await this.prisma.riskUserProfile.upsert({
      where: { userId },
      create: {
        userId,
        aggregateScore: 80,
        riskLevel: RiskLevel.critical,
        freezeWithdrawals: true,
        freezeReferralRewards: true,
        freezeCouponRedemption: true,
      },
      update: {
        riskLevel: RiskLevel.critical,
        freezeWithdrawals: true,
        freezeReferralRewards: true,
        freezeCouponRedemption: true,
      },
    });

    await this.prisma.riskDecisionAudit.create({
      data: {
        userId,
        action: 'risk.auto_freeze_critical',
        riskScore: 80,
        details: { freezes: ['withdrawals', 'referral_rewards', 'coupon_redemption'] } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getRestrictions(userId: string) {
    const profile = await this.prisma.riskUserProfile.findUnique({ where: { userId } });
    return {
      freezeWithdrawals: profile?.freezeWithdrawals ?? false,
      freezeReferralRewards: profile?.freezeReferralRewards ?? false,
      freezeCouponRedemption: profile?.freezeCouponRedemption ?? false,
      requireReKyc: profile?.requireReKyc ?? false,
      riskLevel: profile?.riskLevel ?? RiskLevel.low,
      aggregateScore: profile?.aggregateScore ?? 0,
    };
  }
}