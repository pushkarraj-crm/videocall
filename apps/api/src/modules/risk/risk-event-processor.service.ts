import { Injectable, Logger } from '@nestjs/common';
import {
  KycVerificationStatus,
  PaymentStatus,
  ReferralStatus,
  RiskEventType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RiskEngineService } from './risk-engine.service';

@Injectable()
export class RiskEventProcessorService {
  private readonly logger = new Logger(RiskEventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: RiskEngineService,
  ) {}

  async processCrossModuleEvents() {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    let processed = 0;

    processed += await this.processSignups(since);
    processed += await this.processPayments(since);
    processed += await this.processWithdrawals(since);
    processed += await this.processReferrals(since);
    processed += await this.processPromos(since);
    processed += await this.processKyc(since);
    processed += await this.processCalls(since);

    return { processed };
  }

  private async alreadyEvaluated(userId: string, eventType: RiskEventType, refId: string) {
    const recent = await this.prisma.riskEvent.findMany({
      where: {
        userId,
        eventType,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { metadata: true },
      take: 30,
    });
    return recent.some(
      (e) => (e.metadata as { referenceId?: string } | null)?.referenceId === refId,
    );
  }

  private async processSignups(since: Date) {
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      take: 15,
      select: { id: true, deviceFingerprint: true },
    });

    let count = 0;
    for (const u of users) {
      if (await this.alreadyEvaluated(u.id, RiskEventType.signup, u.id)) continue;
      await this.engine.evaluate({
        userId: u.id,
        eventType: RiskEventType.signup,
        fingerprint: u.deviceFingerprint ?? undefined,
        metadata: { referenceId: u.id },
      });
      count++;
    }
    return count;
  }

  private async processPayments(since: Date) {
    const payments = await this.prisma.payment.findMany({
      where: { updatedAt: { gte: since } },
      take: 20,
    });

    let count = 0;
    for (const p of payments) {
      const eventType =
        p.status === PaymentStatus.paid ? RiskEventType.recharge : RiskEventType.payment_failed;
      if (await this.alreadyEvaluated(p.userId, eventType, p.id)) continue;
      await this.engine.evaluate({
        userId: p.userId,
        eventType,
        metadata: { referenceId: p.id, amountInr: p.totalInr.toString() },
      });
      count++;
    }
    return count;
  }

  private async processWithdrawals(since: Date) {
    const rows = await this.prisma.withdrawal.findMany({
      where: { createdAt: { gte: since } },
      take: 15,
    });

    let count = 0;
    for (const w of rows) {
      if (await this.alreadyEvaluated(w.hostId, RiskEventType.withdrawal, w.id)) continue;
      await this.engine.evaluate({
        userId: w.hostId,
        eventType: RiskEventType.withdrawal,
        metadata: { referenceId: w.id, amountInr: w.amountInr.toString() },
      });
      count++;
    }
    return count;
  }

  private async processReferrals(since: Date) {
    const rows = await this.prisma.referral.findMany({
      where: { createdAt: { gte: since } },
      take: 15,
    });

    let count = 0;
    for (const r of rows) {
      for (const userId of [r.referrerId, r.referredId]) {
        const key = `${r.id}:${userId}`;
        if (await this.alreadyEvaluated(userId, RiskEventType.referral, key)) continue;
        await this.engine.evaluate({
          userId,
          eventType: RiskEventType.referral,
          ip: r.referredIp ?? undefined,
          fingerprint: r.referredDeviceFingerprint ?? undefined,
          metadata: { referenceId: key, referralId: r.id, status: r.status },
        });
        count++;
      }
    }
    return count;
  }

  private async processPromos(since: Date) {
    const usages = await this.prisma.promoUsage.findMany({
      where: { createdAt: { gte: since } },
      take: 15,
    });

    let count = 0;
    for (const u of usages) {
      if (await this.alreadyEvaluated(u.userId, RiskEventType.coupon, u.id)) continue;
      await this.engine.evaluate({
        userId: u.userId,
        eventType: RiskEventType.coupon,
        metadata: { referenceId: u.id, promoId: u.promoId },
      });
      count++;
    }
    return count;
  }

  private async processKyc(since: Date) {
    const rows = await this.prisma.hostKyc.findMany({
      where: {
        updatedAt: { gte: since },
        verificationStatus: { in: [KycVerificationStatus.pending, KycVerificationStatus.in_review] },
      },
      take: 10,
    });

    let count = 0;
    for (const k of rows) {
      if (await this.alreadyEvaluated(k.userId, RiskEventType.kyc_submit, k.id)) continue;
      await this.engine.evaluate({
        userId: k.userId,
        eventType: RiskEventType.kyc_submit,
        metadata: { referenceId: k.id, kycId: k.id },
      });
      count++;
    }
    return count;
  }

  private async processCalls(since: Date) {
    const calls = await this.prisma.call.findMany({
      where: { endedAt: { gte: since } },
      take: 20,
    });

    let count = 0;
    for (const c of calls) {
      if (await this.alreadyEvaluated(c.callerId, RiskEventType.call, c.id)) continue;
      await this.engine.evaluate({
        userId: c.callerId,
        eventType: RiskEventType.call,
        ip: c.callerIp ?? undefined,
        metadata: { referenceId: c.id, callId: c.id },
      });
      count++;
    }
    return count;
  }
}