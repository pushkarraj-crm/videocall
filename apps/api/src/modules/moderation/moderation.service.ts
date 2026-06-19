import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppealStatus,
  ModerationQueueStatus,
  ReportStatus,
  ResolutionAction,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async recordAbuseSignal(
    userId: string,
    signalType: string,
    scoreDelta: number,
    meta?: { sourceTable?: string; sourceId?: string },
  ) {
    await this.prisma.abuseSignal.create({
      data: {
        userId,
        signalType,
        scoreDelta,
        sourceTable: meta?.sourceTable,
        sourceId: meta?.sourceId,
      },
    });

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { abuseScore: { increment: scoreDelta } },
    });

    const suspendThreshold = this.config.get<number>('ABUSE_SUSPEND_THRESHOLD', 80);
    const banThreshold = this.config.get<number>('ABUSE_BAN_THRESHOLD', 100);

    if (user.abuseScore >= banThreshold) {
      await this.usersService.updateStatus(userId, UserStatus.banned);
    } else if (user.abuseScore >= suspendThreshold) {
      await this.usersService.updateStatus(userId, UserStatus.suspended);
    }

    return user.abuseScore;
  }

  async autoSuspendForCriticalReport(userId: string, reportId: string) {
    await this.usersService.updateStatus(userId, UserStatus.suspended);

    return this.prisma.accountSuspension.create({
      data: {
        userId,
        reason: 'Critical report — auto-suspended pending review',
        suspendedById: userId,
        reportId,
        isPermanent: false,
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        appealStatus: AppealStatus.none,
      },
    });
  }

  async getReportQueue(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { status: { in: [ReportStatus.open, ReportStatus.reviewing] } },
        orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.report.count({
        where: { status: { in: [ReportStatus.open, ReportStatus.reviewing] } },
      }),
    ]);

    return { items, total, page, limit };
  }

  async resolveReport(
    reportId: string,
    moderatorId: string,
    resolution: string,
    action: ResolutionAction,
  ) {
    const report = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.resolved,
        resolution,
        resolutionAction: action,
        resolvedById: moderatorId,
        resolvedAt: new Date(),
        assignedToId: moderatorId,
      },
    });

    if (action === ResolutionAction.permanent_ban) {
      await this.usersService.updateStatus(report.reportedId, UserStatus.banned);
    } else if (action === ResolutionAction.temp_suspend) {
      await this.usersService.updateStatus(report.reportedId, UserStatus.suspended);
    }

    if (action !== ResolutionAction.dismissed) {
      await this.recordAbuseSignal(report.reportedId, 'report_upheld', 30, {
        sourceTable: 'reports',
        sourceId: reportId,
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: moderatorId,
        action: 'report.resolve',
        entityType: 'report',
        entityId: reportId,
        newValue: { resolution, action },
      },
    });

    return report;
  }

  async getModerationQueue(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    return this.prisma.moderationQueue.findMany({
      where: { status: ModerationQueueStatus.pending },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      skip,
      take: limit,
    });
  }
}