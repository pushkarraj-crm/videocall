import { Injectable, Logger } from '@nestjs/common';
import {
  CommunicationEventType,
  KycVerificationStatus,
  PaymentStatus,
  ReferralStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationsDispatcherService } from './communications-dispatcher.service';

@Injectable()
export class CommunicationEventProcessorService {
  private readonly logger = new Logger(CommunicationEventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: CommunicationsDispatcherService,
  ) {}

  async processCrossModuleEvents() {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    let processed = 0;

    processed += await this.processRecharges(since);
    processed += await this.processKyc(since);
    processed += await this.processWithdrawals(since);
    processed += await this.processReferrals(since);
    processed += await this.processPromos(since);

    return { processed };
  }

  private async hasQueued(userId: string, eventType: CommunicationEventType, referenceId: string) {
    const existing = await this.prisma.communicationQueueItem.findFirst({
      where: { userId, eventType, referenceId },
      select: { id: true },
    });
    return Boolean(existing);
  }

  private async processRecharges(since: Date) {
    const payments = await this.prisma.payment.findMany({
      where: {
        OR: [
          { status: PaymentStatus.paid, paidAt: { gte: since } },
          { status: PaymentStatus.failed, updatedAt: { gte: since } },
        ],
      },
      include: { user: { select: { id: true, email: true, phone: true, displayName: true } } },
      take: 20,
    });

    let count = 0;
    for (const p of payments) {
      const eventType =
        p.status === PaymentStatus.paid
          ? CommunicationEventType.recharge_success
          : CommunicationEventType.recharge_failed;

      if (await this.hasQueued(p.userId, eventType, p.id)) continue;

      const coins = String(Number(p.coinUnitsCredited) / 100);
      const amountInr = p.totalInr.toString();

      if (p.user.email) {
        await this.dispatcher.sendEmail({
          userId: p.userId,
          to: p.user.email,
          eventType:
            p.status === PaymentStatus.paid
              ? CommunicationEventType.receipt
              : CommunicationEventType.recharge_failed,
          templateData: {
            name: p.user.displayName,
            amountInr,
            coins,
            invoiceNumber: p.invoiceNumber ?? '',
            paidAt: p.paidAt?.toISOString() ?? '',
          },
          referenceId: p.id,
          referenceType: 'PAYMENT',
        });
        count++;
      }

      if (p.status === PaymentStatus.paid && p.user.phone) {
        await this.dispatcher.sendSms({
          userId: p.userId,
          to: p.user.phone,
          eventType: CommunicationEventType.recharge_success,
          templateData: { amountInr, coins },
          referenceId: p.id,
          referenceType: 'PAYMENT',
          idempotencyKey: `recharge:sms:${p.id}`,
        });
        count++;
      }
    }
    return count;
  }

  private async processKyc(since: Date) {
    const records = await this.prisma.hostKyc.findMany({
      where: {
        updatedAt: { gte: since },
        verificationStatus: {
          in: [
            KycVerificationStatus.pending,
            KycVerificationStatus.in_review,
            KycVerificationStatus.verified,
            KycVerificationStatus.failed,
          ],
        },
      },
      include: { user: { select: { id: true, email: true, phone: true, displayName: true } } },
      take: 20,
    });

    let count = 0;
    for (const k of records) {
      const eventType =
        k.verificationStatus === KycVerificationStatus.verified
          ? CommunicationEventType.kyc_approved
          : k.verificationStatus === KycVerificationStatus.failed
            ? CommunicationEventType.kyc_rejected
            : k.verificationStatus === KycVerificationStatus.in_review
              ? CommunicationEventType.kyc_submitted
              : CommunicationEventType.kyc_submitted;

      if (await this.hasQueued(k.userId, eventType, k.id)) continue;

      const status = k.verificationStatus;
      if (k.user.email) {
        await this.dispatcher.sendEmail({
          userId: k.userId,
          to: k.user.email,
          eventType,
          templateData: {
            name: k.user.displayName,
            status,
            reason: k.failureReason ?? '',
          },
          referenceId: k.id,
          referenceType: 'KYC',
        });
        count++;
      }

      if (k.user.phone) {
        await this.dispatcher.sendSms({
          userId: k.userId,
          to: k.user.phone,
          eventType,
          templateData: { status },
          referenceId: k.id,
          referenceType: 'KYC',
          idempotencyKey: `kyc:sms:${k.id}:${status}`,
        });
        count++;
      }
    }
    return count;
  }

  private async processWithdrawals(since: Date) {
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { updatedAt: { gte: since } },
      include: { host: { select: { id: true, email: true, phone: true, displayName: true } } },
      take: 20,
    });

    let count = 0;
    for (const w of withdrawals) {
      const eventType = this.withdrawalEvent(w.status);
      if (!eventType) continue;
      if (await this.hasQueued(w.hostId, eventType, w.id)) continue;

      const amountInr = w.amountInr.toString();
      const status = w.status;

      if (w.host.email) {
        await this.dispatcher.sendEmail({
          userId: w.hostId,
          to: w.host.email,
          eventType,
          templateData: {
            name: w.host.displayName,
            status,
            amountInr,
            note: w.adminNote ?? w.rejectionReason ?? '',
          },
          referenceId: w.id,
          referenceType: 'WITHDRAWAL',
        });
        count++;
      }

      if (w.host.phone) {
        await this.dispatcher.sendSms({
          userId: w.hostId,
          to: w.host.phone,
          eventType,
          templateData: { status, amountInr },
          referenceId: w.id,
          referenceType: 'WITHDRAWAL',
          idempotencyKey: `withdrawal:sms:${w.id}:${status}`,
        });
        count++;
      }
    }
    return count;
  }

  private withdrawalEvent(status: WithdrawalStatus): CommunicationEventType | null {
    switch (status) {
      case WithdrawalStatus.requested:
        return CommunicationEventType.withdrawal_submitted;
      case WithdrawalStatus.approved:
      case WithdrawalStatus.processing:
        return CommunicationEventType.withdrawal_approved;
      case WithdrawalStatus.rejected:
        return CommunicationEventType.withdrawal_rejected;
      case WithdrawalStatus.completed:
        return CommunicationEventType.withdrawal_paid;
      default:
        return null;
    }
  }

  private async processReferrals(since: Date) {
    const referrals = await this.prisma.referral.findMany({
      where: {
        OR: [
          { status: ReferralStatus.rewarded, rewardedAt: { gte: since } },
          { status: ReferralStatus.qualified, qualifiedAt: { gte: since } },
        ],
      },
      include: {
        referrer: { select: { id: true, email: true, displayName: true } },
        referred: { select: { displayName: true } },
      },
      take: 20,
    });

    let count = 0;
    for (const r of referrals) {
      if (r.status === ReferralStatus.rewarded) {
        for (const userId of [r.referrerId, r.referredId]) {
          const eventType = CommunicationEventType.referral_reward;
          if (await this.hasQueued(userId, eventType, r.id)) continue;
          const user =
            userId === r.referrerId
              ? r.referrer
              : await this.prisma.user.findUnique({
                  where: { id: userId },
                  select: { id: true, email: true, displayName: true },
                });
          if (!user?.email) continue;
          await this.dispatcher.sendEmail({
            userId,
            to: user.email,
            eventType,
            templateData: {
              name: user.displayName,
              coins: 'bonus',
            },
            referenceId: r.id,
            referenceType: 'REFERRAL',
            idempotencyKey: `referral:reward:${r.id}:${userId}`,
          });
          count++;
        }
      }

      if (r.status === ReferralStatus.qualified && r.referrer.email) {
        const eventType = CommunicationEventType.friend_joined;
        if (await this.hasQueued(r.referrerId, eventType, r.id)) continue;
        await this.dispatcher.sendEmail({
          userId: r.referrerId,
          to: r.referrer.email,
          eventType,
          templateData: {
            name: r.referrer.displayName,
            friendName: r.referred.displayName,
          },
          referenceId: r.id,
          referenceType: 'REFERRAL',
        });
        count++;
      }
    }
    return count;
  }

  private async processPromos(since: Date) {
    const promos = await this.prisma.promoCode.findMany({
      where: {
        isActive: true,
        startsAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gte: since } }],
      },
      take: 5,
    });

    let count = 0;
    for (const promo of promos) {
      const users = await this.prisma.user.findMany({
        where: { status: 'active', email: { not: null } },
        select: { id: true, email: true, displayName: true },
        take: 10,
      });

      for (const user of users) {
        if (!user.email) continue;
        const eventType = CommunicationEventType.coupon_available;
        const key = `promo:${promo.id}:${user.id}`;
        if (await this.hasQueued(user.id, eventType, promo.id)) continue;

        await this.dispatcher.sendEmail({
          userId: user.id,
          to: user.email,
          eventType,
          templateData: {
            name: user.displayName,
            title: `Coupon: ${promo.code}`,
            message: promo.description ?? `Use code ${promo.code} on your next recharge.`,
          },
          referenceId: promo.id,
          referenceType: 'PROMOTION',
          idempotencyKey: key,
        });
        count++;
      }
    }
    return count;
  }
}