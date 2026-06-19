import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AdminService } from '../admin/admin.service';
import { ReferralsService } from '../referrals/referrals.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
    private readonly admin: AdminService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processReferralRewards() {
    if (!this.prisma.isConnected) return;
    const result = await this.referrals.processPendingRewards();
    if (result.processed > 0) {
      this.logger.log(`Processed ${result.processed} referral rewards`);
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