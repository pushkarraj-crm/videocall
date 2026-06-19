import { Injectable } from '@nestjs/common';
import { ReportCategory, ReportSeverity, ReportStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  private severityForCategory(category: ReportCategory): ReportSeverity {
    switch (category) {
      case ReportCategory.minor_safety:
      case ReportCategory.inappropriate_content:
        return ReportSeverity.critical;
      case ReportCategory.fraud:
      case ReportCategory.harassment:
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

    const severity = this.severityForCategory(dto.category);

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedId: dto.reportedId,
        callId: dto.callId,
        messageId: dto.messageId,
        category: dto.category,
        description: dto.description,
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

    return report;
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