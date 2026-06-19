import { Injectable } from '@nestjs/common';
import {
  HostApplicationStatus,
  HostEarningStatus,
  KycVerificationStatus,
  Role,
  WithdrawalStatus,
} from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { UsersService } from '../users/users.service';
import { ReviewHostApplicationDto } from './dto/review-host-application.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly moderationService: ModerationService,
  ) {}

  async searchUsers(query: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            { email: { contains: query, mode: 'insensitive' } },
            { referralCode: { contains: query, mode: 'insensitive' } },
          ],
        },
        skip,
        take: limit,
        select: {
          id: true,
          displayName: true,
          phone: true,
          email: true,
          status: true,
          abuseScore: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return { users, total, page, limit };
  }

  async updateUserStatus(adminId: string, userId: string, dto: UpdateUserStatusDto) {
    const user = await this.usersService.updateStatus(userId, dto.status);

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'user.status_update',
        entityType: 'user',
        entityId: userId,
        newValue: { status: dto.status, reason: dto.reason },
      },
    });

    return user;
  }

  async getHostApplications(status?: HostApplicationStatus) {
    return this.prisma.hostApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  async reviewHostApplication(
    adminId: string,
    applicationId: string,
    dto: ReviewHostApplicationDto,
  ) {
    const application = await this.prisma.hostApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });

    const verifiedKyc = await this.prisma.hostKyc.findFirst({
      where: {
        userId: application.userId,
        verificationStatus: KycVerificationStatus.verified,
      },
    });

    if (dto.status === HostApplicationStatus.approved && !verifiedKyc) {
      throw new BusinessException('KYC must be verified before approval', 400, 'KYC_REQUIRED');
    }

    const updated = await this.prisma.hostApplication.update({
      where: { id: applicationId },
      data: {
        status: dto.status,
        applicationNote: dto.notes,
        rejectionReason: dto.rejectionReason,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    if (dto.status === HostApplicationStatus.approved) {
      await this.usersService.assignRole(application.userId, Role.host, adminId);
      await this.prisma.hostProfile.upsert({
        where: { userId: application.userId },
        update: { approvedAt: new Date() },
        create: { userId: application.userId, approvedAt: new Date() },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'host_application.review',
        entityType: 'host_application',
        entityId: applicationId,
        newValue: { ...dto } as object,
      },
    });

    return updated;
  }

  async getAnalytics() {
    const [totalUsers, activeHosts, callsToday, revenueToday] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.hostProfile.count({ where: { isAvailable: true } }),
      this.prisma.call.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'paid',
          paidAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { totalInr: true },
      }),
    ]);

    return {
      totalUsers,
      activeHosts,
      callsToday,
      revenueTodayInr: revenueToday._sum.totalInr ?? 0,
    };
  }

  async approveWithdrawal(adminId: string, withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.approved,
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'withdrawal.approve',
        entityType: 'withdrawal',
        entityId: withdrawalId,
      },
    });

    return withdrawal;
  }

  async releaseHeldEarnings() {
    const now = new Date();

    const earnings = await this.prisma.hostEarning.findMany({
      where: {
        status: HostEarningStatus.held,
        availableAt: { lte: now },
      },
      take: 100,
    });

    for (const earning of earnings) {
      await this.prisma.$transaction(async (tx) => {
        await tx.hostEarning.update({
          where: { id: earning.id },
          data: { status: HostEarningStatus.available },
        });

        await tx.hostProfile.update({
          where: { userId: earning.hostId },
          data: { withdrawableUnits: { increment: earning.netUnits } },
        });
      });
    }

    return { released: earnings.length };
  }

  getReports(page?: number, limit?: number) {
    return this.moderationService.getReportQueue(page, limit);
  }

  resolveReport(
    moderatorId: string,
    reportId: string,
    resolution: string,
    action: Parameters<ModerationService['resolveReport']>[3],
  ) {
    return this.moderationService.resolveReport(
      reportId,
      moderatorId,
      resolution,
      action,
    );
  }

  getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  getConfig() {
    return this.prisma.platformConfig.findMany();
  }

  async updateConfig(adminId: string, key: string, value: unknown) {
    const updated = await this.prisma.platformConfig.upsert({
      where: { key },
      update: { value: value as object, updatedById: adminId },
      create: { key, value: value as object, updatedById: adminId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'config.update',
        entityType: 'platform_config',
        entityId: null,
        newValue: { key, value: value as object },
      },
    });

    return updated;
  }
}