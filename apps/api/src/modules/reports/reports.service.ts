import { Injectable } from '@nestjs/common';
import { ReportCategory, ReportSeverity, ReportStatus } from '@prisma/client';
import { serializeReport } from '../../common/utils/report-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReportDto } from './dto/create-report.dto';

const DAILY_REPORT_LIMIT = 5;
const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  private severityForCategory(category: ReportCategory): ReportSeverity {
    switch (category) {
      case ReportCategory.minor_safety:
      case ReportCategory.underage:
      case ReportCategory.inappropriate_content:
      case ReportCategory.nudity:
        return ReportSeverity.critical;
      case ReportCategory.fraud:
      case ReportCategory.scam:
      case ReportCategory.harassment:
      case ReportCategory.abusive_language:
        return ReportSeverity.high;
      case ReportCategory.spam:
        return ReportSeverity.medium;
      default:
        return ReportSeverity.low;
    }
  }

  async createReport(reporterId: string, dto: CreateReportDto) {
    if (reporterId === dto.reportedId) {
      throw new BusinessException('Cannot report yourself', 400, 'SELF_REPORT');
    }

    const reported = await this.prisma.user.findFirst({
      where: { id: dto.reportedId, deletedAt: null },
      select: { id: true },
    });
    if (!reported) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }

    await this.enforceRateLimit(reporterId);
    await this.enforceDuplicateGuard(reporterId, dto);

    const severity = this.severityForCategory(dto.category);

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedId: dto.reportedId,
        callId: dto.callId,
        messageId: dto.messageId,
        category: dto.category,
        description: dto.description?.trim() || null,
        evidenceUrl: dto.evidenceUrl,
        severity,
        status: ReportStatus.open,
      },
    });

    await this.moderation.recordAbuseSignal(dto.reportedId, 'report_received', 10, {
      sourceTable: 'reports',
      sourceId: report.id,
    });

    if (severity === ReportSeverity.critical) {
      await this.moderation.autoSuspendForCriticalReport(dto.reportedId, report.id);
    }

    const reportCount = await this.prisma.report.count({
      where: { reportedId: dto.reportedId },
    });

    return serializeReport(report, reportCount);
  }

  async listMyReports(reporterId: string, page = 1, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;

    const [rows, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { reporterId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          reported: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.report.count({ where: { reporterId } }),
    ]);

    return {
      items: rows.map((row) => serializeReport(row)),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  private async enforceRateLimit(reporterId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await this.prisma.report.count({
      where: { reporterId, createdAt: { gte: since } },
    });

    if (count >= DAILY_REPORT_LIMIT) {
      throw new BusinessException(
        'Daily report limit reached (5 per day)',
        429,
        'REPORT_RATE_LIMIT',
      );
    }
  }

  private async enforceDuplicateGuard(reporterId: string, dto: CreateReportDto) {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId,
        reportedId: dto.reportedId,
        ...(dto.callId ? { callId: dto.callId } : {}),
        createdAt: { gte: since },
        status: { in: [ReportStatus.open, ReportStatus.reviewing, ReportStatus.escalated] },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BusinessException(
        'You already reported this user for this incident',
        409,
        'DUPLICATE_REPORT',
      );
    }
  }

  async blockUser(blockerId: string, dto: CreateBlockDto) {
    if (blockerId === dto.userId) {
      throw new BusinessException('Cannot block yourself', 400, 'SELF_BLOCK');
    }

    return this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: dto.userId } },
      update: { reason: dto.reason },
      create: {
        blockerId,
        blockedId: dto.userId,
        reason: dto.reason,
      },
    });
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    return { unblocked: true };
  }

  async listBlocks(userId: string) {
    return this.prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }
}