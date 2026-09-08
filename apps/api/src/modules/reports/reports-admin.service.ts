import { Injectable } from '@nestjs/common';
import { Prisma, ReportStatus, ResolutionAction, UserStatus } from '@prisma/client';
import { serializeReport } from '../../common/utils/report-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AdminReportsQueryDto } from './dto/admin-reports-query.dto';
import { ReportAdminAction, UpdateReportDto } from './dto/update-report.dto';

const USER_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class ReportsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async listReports(query: AdminReportsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.reason) where.category = query.reason;
    if (query.reporterId) where.reporterId = query.reporterId;
    if (query.reportedUserId) where.reportedId = query.reportedUserId;

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { adminNote: { contains: q, mode: 'insensitive' } },
        { reporter: { displayName: { contains: q, mode: 'insensitive' } } },
        { reported: { displayName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const orderBy =
      query.sort === 'oldest'
        ? [{ createdAt: 'asc' as const }]
        : [{ createdAt: 'desc' as const }];

    const [rows, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          reporter: { select: USER_SELECT },
          reported: { select: USER_SELECT },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    const counts = await this.countReportsByUser(rows.map((r) => r.reportedId));
    const items = rows.map((row) =>
      serializeReport(row, counts.get(row.reportedId) ?? 0),
    );

    return { items, total, page, limit };
  }

  async getReportById(reportId: string) {
    const row = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: { select: USER_SELECT },
        reported: { select: USER_SELECT },
      },
    });

    if (!row) {
      throw new BusinessException('Report not found', 404, 'REPORT_NOT_FOUND');
    }

    const [reportCount, previousReports] = await Promise.all([
      this.prisma.report.count({ where: { reportedId: row.reportedId } }),
      this.prisma.report.findMany({
        where: { reportedId: row.reportedId, NOT: { id: reportId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          reporter: { select: USER_SELECT },
        },
      }),
    ]);

    const previousCounts = await this.countReportsByUser(
      previousReports.map((r) => r.reportedId),
    );

    return {
      report: serializeReport(row, reportCount),
      previousReports: previousReports.map((r) =>
        serializeReport(r, previousCounts.get(r.reportedId) ?? reportCount),
      ),
      reportedUserReportCount: reportCount,
    };
  }

  async updateReport(adminId: string, reportId: string, dto: UpdateReportDto) {
    const existing = await this.prisma.report.findUniqueOrThrow({
      where: { id: reportId },
    });

    if (dto.action === ReportAdminAction.internal_note) {
      const updated = await this.prisma.report.update({
        where: { id: reportId },
        data: { adminNote: dto.adminNote?.trim() || existing.adminNote },
      });

      await this.logAction(adminId, reportId, dto.action, dto.adminNote);
      const count = await this.prisma.report.count({
        where: { reportedId: updated.reportedId },
      });
      return serializeReport(updated, count);
    }

    const resolutionAction = this.mapAction(dto);
    const status = this.mapStatus(dto.action);
    const resolution =
      dto.resolution?.trim() ||
      (dto.action === ReportAdminAction.reject
        ? 'Report rejected'
        : dto.action === ReportAdminAction.under_review
          ? 'Marked under review'
          : 'Resolved by admin');

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        resolution,
        resolutionAction,
        adminNote: dto.adminNote?.trim() || existing.adminNote,
        resolvedById:
          status === ReportStatus.resolved || status === ReportStatus.dismissed
            ? adminId
            : existing.resolvedById,
        resolvedAt:
          status === ReportStatus.resolved || status === ReportStatus.dismissed
            ? new Date()
            : existing.resolvedAt,
        assignedToId: adminId,
      },
    });

    await this.applyUserAction(updated.reportedId, dto, adminId);
    await this.logAction(adminId, reportId, dto.action, resolution);

    const count = await this.prisma.report.count({
      where: { reportedId: updated.reportedId },
    });
    return serializeReport(updated, count);
  }

  private mapStatus(action: ReportAdminAction): ReportStatus {
    switch (action) {
      case ReportAdminAction.under_review:
        return ReportStatus.reviewing;
      case ReportAdminAction.reject:
        return ReportStatus.dismissed;
      case ReportAdminAction.resolve:
      case ReportAdminAction.warning:
      case ReportAdminAction.suspend_user:
      case ReportAdminAction.suspend_host:
      case ReportAdminAction.permanent_ban:
        return ReportStatus.resolved;
      default:
        return ReportStatus.open;
    }
  }

  private mapAction(dto: UpdateReportDto): ResolutionAction | null {
    if (dto.legacyAction) return dto.legacyAction;
    switch (dto.action) {
      case ReportAdminAction.reject:
        return ResolutionAction.dismissed;
      case ReportAdminAction.warning:
        return ResolutionAction.warning;
      case ReportAdminAction.suspend_user:
      case ReportAdminAction.suspend_host:
        return ResolutionAction.temp_suspend;
      case ReportAdminAction.permanent_ban:
        return ResolutionAction.permanent_ban;
      case ReportAdminAction.resolve:
        return ResolutionAction.warning;
      default:
        return null;
    }
  }

  private async applyUserAction(
    reportedUserId: string,
    dto: UpdateReportDto,
    adminId: string,
  ) {
    if (dto.enableCommunityWarning) {
      await this.prisma.user.update({
        where: { id: reportedUserId },
        data: { communityWarningVisible: true },
      });
    }

    switch (dto.action) {
      case ReportAdminAction.suspend_user:
      case ReportAdminAction.suspend_host:
        await this.usersService.updateStatus(reportedUserId, UserStatus.suspended);
        break;
      case ReportAdminAction.permanent_ban:
        await this.usersService.updateStatus(reportedUserId, UserStatus.banned);
        break;
      case ReportAdminAction.warning:
        if (dto.enableCommunityWarning ?? true) {
          await this.prisma.user.update({
            where: { id: reportedUserId },
            data: { communityWarningVisible: true },
          });
        }
        break;
      default:
        break;
    }

    if (dto.action !== ReportAdminAction.internal_note && dto.action !== ReportAdminAction.reject) {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: `report.${dto.action}`,
          entityType: 'report',
          entityId: reportedUserId,
          newValue: { action: dto.action, adminNote: dto.adminNote ?? null },
        },
      });
    }
  }

  private async logAction(
    adminId: string,
    reportId: string,
    action: string,
    note?: string | null,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: `report.${action}`,
        entityType: 'report',
        entityId: reportId,
        newValue: note ? { note } : undefined,
      },
    });
  }

  private async countReportsByUser(userIds: string[]) {
    const unique = [...new Set(userIds)];
    const counts = new Map<string, number>();
    await Promise.all(
      unique.map(async (userId) => {
        const count = await this.prisma.report.count({ where: { reportedId: userId } });
        counts.set(userId, count);
      }),
    );
    return counts;
  }
}