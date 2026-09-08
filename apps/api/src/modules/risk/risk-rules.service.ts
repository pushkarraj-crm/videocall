import { Injectable } from '@nestjs/common';
import { FraudFlagType, PaymentStatus, Prisma, RiskEventType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { assessReferralFraud } from '../../common/utils/referral-fraud';
import { DEFAULT_RISK_RULES } from './config/risk-rules.config';
import { isDisposableEmail } from './utils/disposable-email';

export interface RuleHit {
  ruleId: string;
  score: number;
  reason: string;
  flagType?: FraudFlagType;
}

export interface EvaluationContext {
  userId: string;
  eventType: RiskEventType;
  ip?: string;
  fingerprint?: string;
  country?: string;
  city?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RiskRulesService {
  private readonly rules = new Map(DEFAULT_RISK_RULES.map((r) => [r.id, r]));

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(ctx: EvaluationContext): Promise<RuleHit[]> {
    const hits: RuleHit[] = [];
    const user = await this.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firebaseUid: true,
        deviceFingerprint: true,
        createdAt: true,
        riskProfile: true,
      },
    });
    if (!user) return hits;

    const enabled = (id: string) => this.rules.get(id)?.enabled ?? false;
    const weight = (id: string) => this.rules.get(id)?.weight ?? 0;

    if (enabled('disposable_email') && isDisposableEmail(user.email)) {
      hits.push({
        ruleId: 'disposable_email',
        score: weight('disposable_email'),
        reason: 'Disposable email domain detected',
        flagType: FraudFlagType.account_abuse,
      });
    }

    const fp = ctx.fingerprint ?? user.deviceFingerprint;
    if (enabled('multi_account_device') && fp) {
      const others = await this.prisma.user.count({
        where: { deviceFingerprint: fp, id: { not: ctx.userId }, deletedAt: null },
      });
      if (others >= 1) {
        hits.push({
          ruleId: 'multi_account_device',
          score: weight('multi_account_device') + Math.min(others * 5, 20),
          reason: `${others + 1} accounts share device fingerprint`,
          flagType: FraudFlagType.multi_account,
        });
      }
    }

    if (enabled('multi_account_ip') && ctx.ip) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const ipHits = await this.prisma.riskEvent.count({
        where: {
          ipAddress: ctx.ip,
          userId: { not: ctx.userId },
          createdAt: { gte: since },
        },
      });
      if (ipHits >= 2) {
        hits.push({
          ruleId: 'multi_account_ip',
          score: weight('multi_account_ip'),
          reason: 'Multiple accounts observed from same IP',
          flagType: FraudFlagType.multi_account,
        });
      }
    }

    if (enabled('rapid_signup_ip') && ctx.ip && ctx.eventType === RiskEventType.signup) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const signups = await this.prisma.user.count({
        where: { createdAt: { gte: hourAgo } },
      });
      if (signups >= 5) {
        hits.push({
          ruleId: 'rapid_signup_ip',
          score: weight('rapid_signup_ip'),
          reason: 'Rapid account creation detected',
          flagType: FraudFlagType.account_abuse,
        });
      }
    }

    if (enabled('country_switch') && ctx.country && user.riskProfile?.lastCountry) {
      if (ctx.country !== user.riskProfile.lastCountry) {
        hits.push({
          ruleId: 'country_switch',
          score: weight('country_switch'),
          reason: `Country changed ${user.riskProfile.lastCountry} → ${ctx.country}`,
          flagType: FraudFlagType.geo_anomaly,
        });
      }
    }

    if (ctx.eventType === RiskEventType.referral) {
      hits.push(...(await this.evaluateReferral(ctx, weight, enabled)));
    }

    if (ctx.eventType === RiskEventType.coupon) {
      hits.push(...(await this.evaluateCoupon(ctx, weight, enabled)));
    }

    if (ctx.eventType === RiskEventType.recharge || ctx.eventType === RiskEventType.payment_failed) {
      hits.push(...(await this.evaluateWallet(ctx, weight, enabled)));
    }

    if (ctx.eventType === RiskEventType.withdrawal) {
      hits.push(...(await this.evaluateWithdrawal(ctx, weight, enabled)));
    }

    if (ctx.eventType === RiskEventType.kyc_submit) {
      hits.push(...(await this.evaluateKyc(ctx, weight, enabled)));
    }

    if (ctx.eventType === RiskEventType.call) {
      hits.push(...(await this.evaluateCall(ctx, weight, enabled)));
    }

    return hits;
  }

  private async evaluateReferral(
    ctx: EvaluationContext,
    weight: (id: string) => number,
    enabled: (id: string) => boolean,
  ): Promise<RuleHit[]> {
    const hits: RuleHit[] = [];
    const referralId = ctx.metadata?.referralId as string | undefined;
    if (!referralId) return hits;

    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referrer: {
          select: { id: true, phone: true, email: true, firebaseUid: true, deviceFingerprint: true },
        },
        referred: {
          select: { id: true, phone: true, email: true, firebaseUid: true, deviceFingerprint: true },
        },
      },
    });
    if (!referral) return hits;

    const fraud = await assessReferralFraud(
      this.prisma,
      referral.referrer,
      referral.referred,
      { ip: referral.referredIp ?? ctx.ip, deviceFingerprint: referral.referredDeviceFingerprint ?? undefined },
    );

    if (fraud.flags.includes('self_referral') && enabled('referral_self')) {
      hits.push({
        ruleId: 'referral_self',
        score: weight('referral_self'),
        reason: 'Self-referral detected',
        flagType: FraudFlagType.referral_fraud,
      });
    }
    if (fraud.flags.includes('same_device') && enabled('referral_same_device')) {
      hits.push({
        ruleId: 'referral_same_device',
        score: weight('referral_same_device'),
        reason: 'Referral from same device as referrer',
        flagType: FraudFlagType.referral_fraud,
      });
    }
    if (fraud.flags.includes('duplicate_ip_referral') && enabled('referral_same_ip')) {
      hits.push({
        ruleId: 'referral_same_ip',
        score: weight('referral_same_ip'),
        reason: 'Duplicate referral IP for referrer',
        flagType: FraudFlagType.referral_fraud,
      });
    }

    if (enabled('referral_farming')) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const count = await this.prisma.referral.count({
        where: { referrerId: referral.referrerId, createdAt: { gte: dayAgo } },
      });
      if (count >= 5) {
        hits.push({
          ruleId: 'referral_farming',
          score: weight('referral_farming'),
          reason: `${count} referrals in 24h`,
          flagType: FraudFlagType.referral_fraud,
        });
      }
    }

    return hits;
  }

  private async evaluateCoupon(
    ctx: EvaluationContext,
    weight: (id: string) => number,
    enabled: (id: string) => boolean,
  ): Promise<RuleHit[]> {
    const hits: RuleHit[] = [];
    const promoId = ctx.metadata?.promoId as string | undefined;
    if (!promoId) return hits;

    if (enabled('coupon_multi_account') && ctx.fingerprint) {
      const others = await this.prisma.promoUsage.count({
        where: {
          promoId,
          user: { deviceFingerprint: ctx.fingerprint, id: { not: ctx.userId } },
        },
      });
      if (others > 0) {
        hits.push({
          ruleId: 'coupon_multi_account',
          score: weight('coupon_multi_account'),
          reason: 'Coupon used across multiple accounts on same device',
          flagType: FraudFlagType.promo_fraud,
        });
      }
    }

    if (enabled('coupon_rapid_attempts')) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const attempts = await this.prisma.riskEvent.count({
        where: {
          userId: ctx.userId,
          eventType: RiskEventType.coupon,
          createdAt: { gte: hourAgo },
        },
      });
      if (attempts >= 5) {
        hits.push({
          ruleId: 'coupon_rapid_attempts',
          score: weight('coupon_rapid_attempts'),
          reason: 'Rapid coupon redemption attempts',
          flagType: FraudFlagType.promo_fraud,
        });
      }
    }

    return hits;
  }

  private async evaluateWallet(
    ctx: EvaluationContext,
    weight: (id: string) => number,
    enabled: (id: string) => boolean,
  ): Promise<RuleHit[]> {
    const hits: RuleHit[] = [];

    if (enabled('payment_failed_burst')) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const failed = await this.prisma.payment.count({
        where: { userId: ctx.userId, status: PaymentStatus.failed, createdAt: { gte: hourAgo } },
      });
      if (failed >= 3) {
        hits.push({
          ruleId: 'payment_failed_burst',
          score: weight('payment_failed_burst'),
          reason: `${failed} failed payments in 1 hour`,
          flagType: FraudFlagType.wallet_fraud,
        });
      }
    }

    if (enabled('recharge_spike') && ctx.eventType === RiskEventType.recharge) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const paid = await this.prisma.payment.aggregate({
        where: { userId: ctx.userId, status: PaymentStatus.paid, paidAt: { gte: dayAgo } },
        _sum: { totalInr: true },
      });
      const total = Number(paid._sum.totalInr ?? 0);
      if (total >= 10000) {
        hits.push({
          ruleId: 'recharge_spike',
          score: weight('recharge_spike'),
          reason: `₹${total} recharged in 24h`,
          flagType: FraudFlagType.wallet_fraud,
        });
      }
    }

    return hits;
  }

  private async evaluateWithdrawal(
    ctx: EvaluationContext,
    weight: (id: string) => number,
    enabled: (id: string) => boolean,
  ): Promise<RuleHit[]> {
    const hits: RuleHit[] = [];

    if (enabled('withdrawal_burst')) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const count = await this.prisma.withdrawal.count({
        where: { hostId: ctx.userId, createdAt: { gte: dayAgo } },
      });
      if (count >= 3) {
        hits.push({
          ruleId: 'withdrawal_burst',
          score: weight('withdrawal_burst'),
          reason: `${count} withdrawal requests in 24h`,
          flagType: FraudFlagType.withdrawal_fraud,
        });
      }
    }

    if (enabled('withdrawal_after_recharge')) {
      const recentPayment = await this.prisma.payment.findFirst({
        where: { userId: ctx.userId, status: PaymentStatus.paid, paidAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
        orderBy: { paidAt: 'desc' },
      });
      if (recentPayment) {
        hits.push({
          ruleId: 'withdrawal_after_recharge',
          score: weight('withdrawal_after_recharge'),
          reason: 'Withdrawal within 2h of recharge',
          flagType: FraudFlagType.withdrawal_fraud,
        });
      }
    }

    return hits;
  }

  private async evaluateKyc(
    ctx: EvaluationContext,
    weight: (id: string) => number,
    enabled: (id: string) => boolean,
  ): Promise<RuleHit[]> {
    const hits: RuleHit[] = [];
    const kycId = ctx.metadata?.kycId as string | undefined;
    if (!kycId || !enabled('duplicate_kyc_doc')) return hits;

    const kyc = await this.prisma.hostKyc.findUnique({ where: { id: kycId } });
    if (!kyc) return hits;

    if (kyc.aadhaarHash) {
      const dup = await this.prisma.hostKyc.count({
        where: { aadhaarHash: kyc.aadhaarHash, userId: { not: ctx.userId } },
      });
      if (dup > 0) {
        hits.push({
          ruleId: 'duplicate_kyc_doc',
          score: weight('duplicate_kyc_doc'),
          reason: 'Duplicate Aadhaar hash across hosts',
          flagType: FraudFlagType.kyc_fraud,
        });
      }
    }

    if (kyc.panHash) {
      const dup = await this.prisma.hostKyc.count({
        where: { panHash: kyc.panHash, userId: { not: ctx.userId } },
      });
      if (dup > 0) {
        hits.push({
          ruleId: 'duplicate_kyc_doc',
          score: weight('duplicate_kyc_doc'),
          reason: 'Duplicate PAN hash across hosts',
          flagType: FraudFlagType.kyc_fraud,
        });
      }
    }

    return hits;
  }

  private async evaluateCall(
    ctx: EvaluationContext,
    weight: (id: string) => number,
    enabled: (id: string) => boolean,
  ): Promise<RuleHit[]> {
    const hits: RuleHit[] = [];
    const callId = ctx.metadata?.callId as string | undefined;

    if (callId && enabled('short_call_farming')) {
      const call = await this.prisma.call.findUnique({
        where: { id: callId },
        select: { durationSeconds: true, coinsChargedUnits: true },
      });
      if (call && call.durationSeconds < 15 && Number(call.coinsChargedUnits) > 0) {
        hits.push({
          ruleId: 'short_call_farming',
          score: weight('short_call_farming'),
          reason: 'Very short paid call',
          flagType: FraudFlagType.call_fraud,
        });
      }
    }

    if (enabled('call_frequency_bot')) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const calls = await this.prisma.call.count({
        where: {
          callerId: ctx.userId,
          createdAt: { gte: hourAgo },
        },
      });
      if (calls >= 20) {
        hits.push({
          ruleId: 'call_frequency_bot',
          score: weight('call_frequency_bot'),
          reason: `${calls} calls in 1 hour`,
          flagType: FraudFlagType.call_fraud,
        });
      }
    }

    return hits;
  }
}