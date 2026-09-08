import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationType,
  PaymentStatus,
  PromoUsageStatus,
  ReferralStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Injectable()
export class NotificationEventProcessorService {
  private readonly logger = new Logger(NotificationEventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async processCrossModuleEvents() {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    let processed = 0;

    processed += await this.processReferralRewards(since);
    processed += await this.processFriendJoined(since);
    processed += await this.processPromoEvents(since);
    processed += await this.processFollowers(since);
    processed += await this.processReviews(since);

    return { processed };
  }

  private async hasNotification(
    userId: string,
    type: NotificationType,
    referenceId: string,
  ) {
    const existing = await this.prisma.notification.findFirst({
      where: { userId, type, referenceId },
      select: { id: true },
    });
    return Boolean(existing);
  }

  private async processReferralRewards(since: Date) {
    const referrals = await this.prisma.referral.findMany({
      where: { status: ReferralStatus.rewarded, rewardedAt: { gte: since } },
      take: 20,
    });

    let count = 0;
    for (const r of referrals) {
      for (const userId of [r.referrerId, r.referredId]) {
        if (await this.hasNotification(userId, NotificationType.referral_reward, r.id)) {
          continue;
        }
        await this.dispatcher.onReferralReward(
          r.id,
          userId,
          userId === r.referrerId ? 'referrer' : 'referred',
        );
        count++;
      }
    }
    return count;
  }

  private async processFriendJoined(since: Date) {
    const referrals = await this.prisma.referral.findMany({
      where: { status: ReferralStatus.qualified, qualifiedAt: { gte: since } },
      take: 20,
      include: { referred: { select: { displayName: true } } },
    });

    let count = 0;
    for (const r of referrals) {
      if (await this.hasNotification(r.referrerId, NotificationType.friend_joined, r.id)) {
        continue;
      }
      await this.dispatcher.onFriendJoined(r.id, r.referrerId, r.referred.displayName);
      count++;
    }
    return count;
  }

  private async processPromoEvents(since: Date) {
    const usages = await this.prisma.promoUsage.findMany({
      where: { status: PromoUsageStatus.completed, createdAt: { gte: since } },
      take: 20,
      include: { promo: { select: { code: true, title: true, bonusCoins: true } } },
    });

    let count = 0;
    for (const u of usages) {
      if (u.bonusCoinsGiven > 0) {
        if (!(await this.hasNotification(u.userId, NotificationType.bonus_coins, u.id))) {
          await this.dispatcher.onBonusCoins(
            u.id,
            u.userId,
            u.bonusCoinsGiven,
            u.promo.code,
          );
          count++;
        }
      }
    }

    const promos = await this.prisma.promoCode.findMany({
      where: {
        isActive: true,
        expiresAt: { gte: new Date(), lte: new Date(Date.now() + 48 * 60 * 60 * 1000) },
      },
      take: 5,
    });

    for (const promo of promos) {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null, status: 'active' },
        select: { id: true },
        take: 100,
      });
      for (const user of users) {
        if (await this.hasNotification(user.id, NotificationType.coupon_expiring, promo.id)) {
          continue;
        }
        await this.dispatcher.onCouponExpiring(promo.id, user.id, promo.code, promo.expiresAt!);
        count++;
      }
    }

    return count;
  }

  private async processFollowers(since: Date) {
    const follows = await this.prisma.hostFollower.findMany({
      where: { createdAt: { gte: since } },
      take: 20,
      include: {
        user: { select: { displayName: true } },
        host: { select: { id: true } },
      },
    });

    let count = 0;
    for (const f of follows) {
      if (await this.hasNotification(f.hostId, NotificationType.new_follower, f.id)) {
        continue;
      }
      await this.dispatcher.onNewFollower(f.id, f.hostId, f.user.displayName);
      count++;
    }
    return count;
  }

  private async processReviews(since: Date) {
    const reviews = await this.prisma.review.findMany({
      where: { createdAt: { gte: since } },
      take: 20,
      include: { user: { select: { displayName: true } } },
    });

    let count = 0;
    for (const review of reviews) {
      if (await this.hasNotification(review.hostId, NotificationType.new_review, review.id)) {
        continue;
      }
      await this.dispatcher.onNewReview(
        review.id,
        review.hostId,
        review.user.displayName,
        review.rating,
      );
      count++;
    }
    return count;
  }
}