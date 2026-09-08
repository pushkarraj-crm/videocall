import { Injectable } from '@nestjs/common';
import {
  HostApplicationStatus,
  HostEarningStatus,
  Role,
  WithdrawalStatus,
} from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { withdrawalDisplayStatus } from '../../common/utils/withdrawal-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { UsersService } from '../users/users.service';
import { ReviewHostApplicationDto } from './dto/review-host-application.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly moderationService: ModerationService,
    private readonly notifications: NotificationDispatcherService,
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

  async getRevenue() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      revenueToday,
      revenueMonth,
      paymentRevenue,
      callPlatformFees,
      giftPlatformFees,
      withdrawnConfig,
      settlements,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'paid', paidAt: { gte: dayStart } },
        _sum: { totalInr: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'paid', paidAt: { gte: monthStart } },
        _sum: { totalInr: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'paid' },
        _sum: { totalInr: true },
      }),
      this.prisma.hostEarning.aggregate({ _sum: { platformFeeUnits: true } }),
      this.prisma.callGift.aggregate({ _sum: { platformFeeUnits: true } }),
      this.prisma.platformConfig.findUnique({
        where: { key: 'platform.revenue.withdrawn_inr' },
      }),
      this.prisma.auditLog.findMany({
        where: { action: 'platform_revenue.withdraw' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          actorId: true,
          action: true,
          newValue: true,
          createdAt: true,
        },
      }),
    ]);

    const platformFeeUnits =
      (callPlatformFees._sum.platformFeeUnits ?? 0n) +
      (giftPlatformFees._sum.platformFeeUnits ?? 0n);
    const platformFeeInr = Number(platformFeeUnits) / 100;
    const rechargeRevenueInr = Number(paymentRevenue._sum.totalInr ?? 0);
    const totalRevenueInr = rechargeRevenueInr + platformFeeInr;
    const withdrawnInr = Number(
      (withdrawnConfig?.value as { amount?: number } | null)?.amount ?? 0,
    );
    const availableRevenueInr = Math.max(0, totalRevenueInr - withdrawnInr);
    const todayRechargeInr = Number(revenueToday._sum.totalInr ?? 0);
    const monthlyRechargeInr = Number(revenueMonth._sum.totalInr ?? 0);

    return {
      totalRevenueInr,
      todayRevenueInr: todayRechargeInr,
      monthlyRevenueInr: monthlyRechargeInr,
      pendingRevenueInr: 0,
      availableRevenueInr,
      platformFeesInr: platformFeeInr,
      rechargeRevenueInr,
      withdrawnInr,
      settlements: settlements.map((s) => ({
        id: s.id,
        action: s.action,
        amountInr: (s.newValue as { amountInr?: number })?.amountInr ?? 0,
        totalWithdrawn: (s.newValue as { totalWithdrawn?: number })?.totalWithdrawn ?? 0,
        createdAt: s.createdAt,
      })),
    };
  }

  async markRevenueSettled(adminId: string, amountInr: number, note?: string) {
    return this.withdrawPlatformRevenue(adminId, amountInr);
  }

  async getAnalytics() {
    const dayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      totalUsers,
      activeHosts,
      callsToday,
      revenueToday,
      paymentRevenue,
      callPlatformFees,
      giftPlatformFees,
      withdrawnConfig,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.hostProfile.count({ where: { isAvailable: true } }),
      this.prisma.call.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.payment.aggregate({
        where: { status: 'paid', paidAt: { gte: dayStart } },
        _sum: { totalInr: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'paid' },
        _sum: { totalInr: true },
      }),
      this.prisma.hostEarning.aggregate({ _sum: { platformFeeUnits: true } }),
      this.prisma.callGift.aggregate({ _sum: { platformFeeUnits: true } }),
      this.prisma.platformConfig.findUnique({
        where: { key: 'platform.revenue.withdrawn_inr' },
      }),
    ]);

    const platformFeeUnits =
      (callPlatformFees._sum.platformFeeUnits ?? 0n) +
      (giftPlatformFees._sum.platformFeeUnits ?? 0n);
    const platformFeeInr = Number(platformFeeUnits) / 100;
    const rechargeRevenueInr = Number(paymentRevenue._sum.totalInr ?? 0);
    const totalRevenueInr = rechargeRevenueInr + platformFeeInr;
    const withdrawnInr = Number(
      (withdrawnConfig?.value as { amount?: number } | null)?.amount ?? 0,
    );
    const availableRevenueInr = Math.max(0, totalRevenueInr - withdrawnInr);

    return {
      totalUsers,
      activeHosts,
      callsToday,
      revenueTodayInr: revenueToday._sum.totalInr ?? 0,
      platformRevenue: {
        rechargeRevenueInr,
        platformFeeInr,
        totalRevenueInr,
        availableRevenueInr,
        withdrawnInr,
      },
    };
  }

  async withdrawPlatformRevenue(adminId: string, amountInr: number) {
    if (amountInr <= 0) {
      throw new BusinessException('Invalid amount', 400, 'INVALID_AMOUNT');
    }

    const analytics = await this.getAnalytics();
    if (amountInr > analytics.platformRevenue.availableRevenueInr) {
      throw new BusinessException('Insufficient available revenue', 400, 'INSUFFICIENT_REVENUE');
    }

    const existing = await this.prisma.platformConfig.findUnique({
      where: { key: 'platform.revenue.withdrawn_inr' },
    });
    const current = Number((existing?.value as { amount?: number } | null)?.amount ?? 0);
    const next = current + amountInr;

    const updated = await this.prisma.platformConfig.upsert({
      where: { key: 'platform.revenue.withdrawn_inr' },
      update: { value: { amount: next }, updatedById: adminId },
      create: {
        key: 'platform.revenue.withdrawn_inr',
        value: { amount: next },
        description: 'Revenue withdrawn to bank',
        updatedById: adminId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'platform_revenue.withdraw',
        entityType: 'platform_config',
        entityId: null,
        newValue: { amountInr, totalWithdrawn: next },
      },
    });

    return { withdrawnInr: next, availableRevenueInr: analytics.platformRevenue.availableRevenueInr - amountInr };
  }

  async getWithdrawals(status?: WithdrawalStatus, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          host: {
            select: {
              id: true,
              displayName: true,
              phone: true,
            },
          },
          bankAccount: {
            select: {
              accountHolderName: true,
              accountNumberMasked: true,
              ifscCode: true,
              bankName: true,
            },
          },
        },
      }),
      this.prisma.withdrawal.count({
        where: status ? { status } : undefined,
      }),
    ]);

    return {
      items: items.map((w) => ({
        id: w.id,
        hostId: w.hostId,
        host: w.host,
        bankAccount: w.bankAccount,
        upiId: w.upiId,
        accountHolderName: w.accountHolderName,
        amountUnits: w.amountUnits.toString(),
        amountCoins: unitsToCoins(w.amountUnits),
        amountInr: w.amountInr.toString(),
        netInr: w.netInr.toString(),
        status: w.status,
        displayStatus: withdrawalDisplayStatus(w.status),
        rejectionReason: w.rejectionReason,
        adminNote: w.adminNote,
        approvedAt: w.approvedAt,
        processedAt: w.processedAt,
        createdAt: w.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async approveWithdrawal(adminId: string, withdrawalId: string, note?: string) {
    const withdrawal = await this.prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawalId },
    });

    if (withdrawal.status !== WithdrawalStatus.requested) {
      throw new BusinessException(
        'Only requested withdrawals can be approved',
        400,
        'INVALID_WITHDRAWAL_STATUS',
      );
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.approved,
        approvedById: adminId,
        approvedAt: new Date(),
        adminNote: note?.trim() || undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'withdrawal.approve',
        entityType: 'withdrawal',
        entityId: withdrawalId,
        newValue: note ? { note } : undefined,
      },
    });

    this.notifications.dispatchSafe(
      this.notifications.onWithdrawalApproved(
        withdrawalId,
        withdrawal.hostId,
        String(withdrawal.amountInr),
      ),
      `withdrawal_approved/${withdrawalId}`,
    );

    return updated;
  }

  async rejectWithdrawal(adminId: string, withdrawalId: string, reason?: string) {
    const withdrawal = await this.prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawalId },
    });

    if (
      withdrawal.status !== WithdrawalStatus.requested &&
      withdrawal.status !== WithdrawalStatus.approved
    ) {
      throw new BusinessException(
        'Withdrawal cannot be rejected in current status',
        400,
        'INVALID_WITHDRAWAL_STATUS',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rejectionNote = reason?.trim() || 'Rejected by admin';
      const result = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.rejected,
          rejectionReason: rejectionNote,
          adminNote: rejectionNote,
        },
      });

      await tx.hostProfile.update({
        where: { userId: withdrawal.hostId },
        data: { withdrawableUnits: { increment: withdrawal.amountUnits } },
      });

      return result;
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'withdrawal.reject',
        entityType: 'withdrawal',
        entityId: withdrawalId,
        newValue: { reason },
      },
    });

    this.notifications.dispatchSafe(
      this.notifications.onWithdrawalRejected(
        withdrawalId,
        withdrawal.hostId,
        String(withdrawal.amountInr),
        reason,
      ),
      `withdrawal_rejected/${withdrawalId}`,
    );

    return updated;
  }

  async markWithdrawalPaid(adminId: string, withdrawalId: string, utr?: string, note?: string) {
    const withdrawal = await this.prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawalId },
    });

    if (withdrawal.status !== WithdrawalStatus.approved) {
      throw new BusinessException(
        'Only approved withdrawals can be marked paid',
        400,
        'INVALID_WITHDRAWAL_STATUS',
      );
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.completed,
        processedAt: new Date(),
        utr: utr ?? null,
        adminNote: note?.trim() || undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'withdrawal.paid',
        entityType: 'withdrawal',
        entityId: withdrawalId,
        newValue: { utr, note },
      },
    });

    return updated;
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