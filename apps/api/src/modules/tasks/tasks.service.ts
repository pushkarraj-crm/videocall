import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AdminService } from '../admin/admin.service';
import { HostsService } from '../hosts/hosts.service';
import { CommunicationEventProcessorService } from '../communications/communication-event-processor.service';
import { CommunicationsAdminService } from '../communications/communications-admin.service';
import { CommunicationsQueueService } from '../communications/communications-queue.service';
import { RiskEventProcessorService } from '../risk/risk-event-processor.service';
import { RiskQueueService } from '../risk/risk-queue.service';
import { NotificationEventProcessorService } from '../notifications/notification-event-processor.service';
import { NotificationsAdminService } from '../notifications/notifications-admin.service';
import { PromotionsService } from '../promotions/promotions.service';
import { ReferralsService } from '../referrals/referrals.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
    private readonly promotions: PromotionsService,
    private readonly notificationEvents: NotificationEventProcessorService,
    private readonly notificationsAdmin: NotificationsAdminService,
    private readonly communicationEvents: CommunicationEventProcessorService,
    private readonly communicationsAdmin: CommunicationsAdminService,
    private readonly communicationsQueue: CommunicationsQueueService,
    private readonly riskEvents: RiskEventProcessorService,
    private readonly riskQueue: RiskQueueService,
    private readonly admin: AdminService,
    private readonly hosts: HostsService,
  ) {}

  @Cron('*/30 * * * * *')
  async sweepStaleHostHeartbeats() {
    if (!this.prisma.isConnected) return;
    const result = await this.hosts.sweepStaleHeartbeats();
    if (result.markedOffline > 0) {
      this.logger.log(`Marked ${result.markedOffline} hosts offline (stale heartbeat)`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processReferralRewards() {
    if (!this.prisma.isConnected) return;
    const qualified = await this.referrals.processPendingQualifications();
    if (qualified.qualified > 0) {
      this.logger.log(`Qualified ${qualified.qualified} referrals`);
    }
    const result = await this.referrals.processPendingRewards();
    if (result.processed > 0) {
      this.logger.log(`Processed ${result.processed} referral rewards`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processNotificationEvents() {
    if (!this.prisma.isConnected) return;
    const cross = await this.notificationEvents.processCrossModuleEvents();
    if (cross.processed > 0) {
      this.logger.log(`Processed ${cross.processed} cross-module notifications`);
    }
    const scheduled = await this.notificationsAdmin.processScheduledBroadcasts();
    if (scheduled.sent > 0) {
      this.logger.log(`Sent ${scheduled.sent} scheduled broadcasts`);
    }
    await this.notificationsAdmin.refreshBroadcastMetrics();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processCommunicationQueue() {
    if (!this.prisma.isConnected) return;
    const queue = await this.communicationsQueue.processQueue();
    if (queue.processed > 0) {
      this.logger.log(`Processed ${queue.processed} communication queue items`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processCommunicationEvents() {
    if (!this.prisma.isConnected) return;
    const cross = await this.communicationEvents.processCrossModuleEvents();
    if (cross.processed > 0) {
      this.logger.log(`Processed ${cross.processed} cross-module communications`);
    }
    const scheduled = await this.communicationsAdmin.processScheduledCampaigns();
    if (scheduled.sent > 0) {
      this.logger.log(`Sent ${scheduled.sent} scheduled communication campaigns`);
    }
    await this.communicationsAdmin.refreshCampaignMetrics();
  }

  @Cron('0 */2 * * * *')
  async processRiskQueue() {
    if (!this.prisma.isConnected) return;
    const queue = await this.riskQueue.processQueue();
    if (queue.processed > 0) {
      this.logger.log(`Processed ${queue.processed} risk queue items`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processRiskEvents() {
    if (!this.prisma.isConnected) return;
    const cross = await this.riskEvents.processCrossModuleEvents();
    if (cross.processed > 0) {
      this.logger.log(`Processed ${cross.processed} cross-module risk events`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processPromoUsages() {
    if (!this.prisma.isConnected) return;
    const result = await this.promotions.processFulfilledPromoUsages();
    if (result.completed > 0) {
      this.logger.log(`Completed ${result.completed} promo redemptions`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async releaseHeldEarnings() {
    if (!this.prisma.isConnected) return;
    const result = await this.admin.releaseHeldEarnings();
    if (result.released > 0) {
      this.logger.log(`Released ${result.released} held earnings`);
    }
  }
}