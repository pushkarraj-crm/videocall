import { Injectable } from '@nestjs/common';
import {
  CallStatus,
  HostApplicationStatus,
  HostProfileType,
  KycVerificationStatus,
  PaymentStatus,
  Prisma,
  Role,
  UserStatus,
} from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { decimalToNumber, startOfDay, endOfDay } from '../../common/utils/analytics-period';
import { kycDisplayStatus } from '../../common/utils/kyc-display';
import { resolveHostStatus } from '../../common/utils/host-status';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { VirtualHostsService } from '../virtual-hosts/virtual-hosts.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

const PENDING_KYC: KycVerificationStatus[] = [
  KycVerificationStatus.pending,
  KycVerificationStatus.in_review,
];

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly virtualHosts: VirtualHostsService,
  ) {}

  async listUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [overview, users, total] = await Promise.all([
      this.getOverview(),
      this.findUsers(query, skip, limit),
      this.countUsers(query),
    ]);

    return { overview, items: users, total, page, limit };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: { where: { revokedAt: null }, select: { role: true } },
        wallet: true,
        hostProfile: true,
        hostApplication: true,
        hostKycRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
        deviceTokens: {
          where: { isActive: true },
          orderBy: { lastUsedAt: 'desc' },
          take: 1,
          select: { platform: true, lastUsedAt: true },
        },
      },
    });

    if (!user) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }

    const [rechargeTotal, callStats, withdrawalTotal] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { userId, status: PaymentStatus.paid },
        _sum: { totalInr: true },
        _count: true,
      }),
      this.prisma.call.aggregate({
        where: { OR: [{ callerId: userId }, { calleeId: userId }] },
        _count: true,
        _sum: { durationSeconds: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { hostId: userId, status: 'completed' },
        _sum: { netInr: true },
        _count: true,
      }),
    ]);

    const roles = user.roles.map((r) => r.role);
    const latestKyc = user.hostKycRecords[0];
    const hostProfile = user.hostProfile;

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      roles,
      status: user.status,
      adminNote: user.adminNote,
      freeCallsUsed: user.freeCallsUsed,
      deviceFingerprint: user.deviceFingerprint,
      lastSeenAt: user.lastSeenAt,
      createdAt: user.createdAt,
      wallet: user.wallet
        ? {
            balanceCoins: unitsToCoins(user.wallet.balanceUnits),
            balanceUnits: user.wallet.balanceUnits.toString(),
            lifetimeCreditedCoins: unitsToCoins(user.wallet.lifetimeCreditedUnits),
          }
        : null,
      host: hostProfile
        ? {
            isOnline: hostProfile.isOnline,
            isBusy: hostProfile.isBusy,
            status: resolveHostStatus(hostProfile.isOnline, hostProfile.isBusy),
            adminCallsDisabled: hostProfile.adminCallsDisabled,
            adminWithdrawalsDisabled: hostProfile.adminWithdrawalsDisabled,
            totalCalls: hostProfile.totalCalls,
            totalEarningsCoins: unitsToCoins(hostProfile.totalEarningsUnits),
            withdrawableCoins: unitsToCoins(hostProfile.withdrawableUnits),
            approvedAt: hostProfile.approvedAt,
          }
        : null,
      hostApplication: user.hostApplication
        ? {
            id: user.hostApplication.id,
            status: user.hostApplication.status,
            reviewedAt: user.hostApplication.reviewedAt,
          }
        : null,
      kyc: latestKyc
        ? {
            id: latestKyc.id,
            status: kycDisplayStatus(latestKyc.verificationStatus),
            adminNote: latestKyc.adminNote ?? latestKyc.failureReason,
            submittedAt: latestKyc.createdAt,
            verifiedAt: latestKyc.verifiedAt,
          }
        : { status: 'NOT_SUBMITTED' as const },
      device: user.deviceTokens[0]
        ? {
            platform: user.deviceTokens[0].platform,
            lastUsedAt: user.deviceTokens[0].lastUsedAt,
          }
        : null,
      stats: {
        totalRechargeInr: decimalToNumber(rechargeTotal._sum.totalInr),
        rechargeCount: rechargeTotal._count,
        totalCalls: callStats._count,
        totalMinutes: Math.round(Number(callStats._sum.durationSeconds ?? 0) / 60),
        totalWithdrawnInr: decimalToNumber(withdrawalTotal._sum.netInr),
        withdrawalCount: withdrawalTotal._count,
      },
    };
  }

  async getUserHistory(
    userId: string,
    type: 'recharges' | 'calls' | 'withdrawals' | 'admin_logs',
    page = 1,
    limit = 20,
  ) {
    await this.ensureUser(userId);
    const skip = (page - 1) * limit;

    switch (type) {
      case 'recharges': {
        const [items, total] = await Promise.all([
          this.prisma.payment.findMany({
            where: { userId, status: PaymentStatus.paid },
            orderBy: { paidAt: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              totalInr: true,
              coinUnitsCredited: true,
              paidAt: true,
              paymentMethod: true,
              package: { select: { name: true } },
            },
          }),
          this.prisma.payment.count({ where: { userId, status: PaymentStatus.paid } }),
        ]);
        return {
          items: items.map((p) => ({
            id: p.id,
            amountInr: decimalToNumber(p.totalInr),
            coins: unitsToCoins(p.coinUnitsCredited),
            packageName: p.package?.name ?? null,
            paymentMethod: p.paymentMethod,
            paidAt: p.paidAt,
          })),
          total,
          page,
          limit,
        };
      }
      case 'calls': {
        const [items, total] = await Promise.all([
          this.prisma.call.findMany({
            where: { OR: [{ callerId: userId }, { calleeId: userId }] },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              callerId: true,
              calleeId: true,
              status: true,
              durationSeconds: true,
              coinsChargedUnits: true,
              createdAt: true,
            },
          }),
          this.prisma.call.count({
            where: { OR: [{ callerId: userId }, { calleeId: userId }] },
          }),
        ]);
        return { items, total, page, limit };
      }
      case 'withdrawals': {
        const [items, total] = await Promise.all([
          this.prisma.withdrawal.findMany({
            where: { hostId: userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              amountInr: true,
              netInr: true,
              status: true,
              upiId: true,
              createdAt: true,
              processedAt: true,
            },
          }),
          this.prisma.withdrawal.count({ where: { hostId: userId } }),
        ]);
        return {
          items: items.map((w) => ({
            ...w,
            amountInr: decimalToNumber(w.amountInr),
            netInr: decimalToNumber(w.netInr),
          })),
          total,
          page,
          limit,
        };
      }
      case 'admin_logs': {
        const [items, total] = await Promise.all([
          this.prisma.adminLog.findMany({
            where: { targetUserId: userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
              admin: { select: { id: true, displayName: true } },
            },
          }),
          this.prisma.adminLog.count({ where: { targetUserId: userId } }),
        ]);
        return { items, total, page, limit };
      }
      default:
        throw new BusinessException('Invalid history type', 400, 'INVALID_HISTORY_TYPE');
    }
  }

  async updateStatus(
    adminId: string,
    userId: string,
    dto: UpdateUserStatusDto,
    ip?: string,
  ) {
    await this.ensureUser(userId);
    const updated = await this.usersService.updateStatus(userId, dto.status);
    await this.logAction(adminId, 'user.status_update', userId, {
      status: dto.status,
      reason: dto.reason,
    }, ip);
    return updated;
  }

  async suspendUser(adminId: string, userId: string, note?: string, ip?: string) {
    await this.ensureUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.suspended,
        adminNote: note?.trim() || undefined,
        sessionRevokedAt: new Date(),
      },
    });
    await this.setHostOfflineInternal(userId);
    await this.logAction(adminId, 'user.suspend', userId, { note }, ip);
    return updated;
  }

  async unsuspendUser(adminId: string, userId: string, ip?: string) {
    return this.updateStatus(adminId, userId, { status: UserStatus.active }, ip);
  }

  async blockUser(adminId: string, userId: string, note?: string, ip?: string) {
    await this.ensureUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.banned,
        adminNote: note?.trim() || undefined,
        sessionRevokedAt: new Date(),
      },
    });
    await this.setHostOfflineInternal(userId);
    await this.logAction(adminId, 'user.block', userId, { note }, ip);
    return updated;
  }

  async unblockUser(adminId: string, userId: string, ip?: string) {
    await this.ensureUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.active },
    });
    await this.logAction(adminId, 'user.unblock', userId, {}, ip);
    return updated;
  }

  async forceLogout(adminId: string, userId: string, ip?: string) {
    await this.ensureUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { sessionRevokedAt: new Date() },
    });
    await this.prisma.deviceToken.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    await this.logAction(adminId, 'user.force_logout', userId, {}, ip);
    return updated;
  }

  async forceOffline(adminId: string, userId: string, ip?: string) {
    await this.ensureUser(userId);
    const profile = await this.prisma.hostProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new BusinessException('User is not a host', 400, 'NOT_A_HOST');
    }
    await this.prisma.hostProfile.update({
      where: { userId },
      data: { isOnline: false, isBusy: false, isAvailable: false, lastSeenAt: new Date() },
    });
    await this.logAction(adminId, 'host.force_offline', userId, {}, ip);
    return { success: true };
  }

  async updateHostControls(
    adminId: string,
    userId: string,
    controls: { callsDisabled?: boolean; withdrawalsDisabled?: boolean },
    ip?: string,
  ) {
    await this.ensureUser(userId);
    const profile = await this.prisma.hostProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new BusinessException('User is not a host', 400, 'NOT_A_HOST');
    }

    const data: Prisma.HostProfileUpdateInput = {};
    if (controls.callsDisabled !== undefined) {
      data.adminCallsDisabled = controls.callsDisabled;
      if (controls.callsDisabled) {
        data.isAvailable = false;
      }
    }
    if (controls.withdrawalsDisabled !== undefined) {
      data.adminWithdrawalsDisabled = controls.withdrawalsDisabled;
    }

    const updated = await this.prisma.hostProfile.update({ where: { userId }, data });
    await this.logAction(adminId, 'host.controls_update', userId, controls, ip);
    return updated;
  }

  async updateAdminNote(adminId: string, userId: string, note: string, ip?: string) {
    await this.ensureUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { adminNote: note.trim() },
    });
    await this.logAction(adminId, 'user.admin_note', userId, { note }, ip);
    return updated;
  }

  async resetFreeCalls(adminId: string, userId: string, ip?: string) {
    await this.ensureUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { freeCallsUsed: 0 },
    });
    await this.logAction(adminId, 'user.reset_free_calls', userId, {}, ip);
    return updated;
  }

  async deleteUser(adminId: string, userId: string, ip?: string) {
    if (adminId === userId) {
      throw new BusinessException('Cannot delete your own account', 403, 'CANNOT_DELETE_SELF');
    }

    await this.ensureUser(userId);

    const roles = await this.usersService.getUserRoles(userId);
    if (roles.some((r) => r === Role.admin || r === Role.super_admin)) {
      throw new BusinessException('Cannot delete admin accounts', 403, 'CANNOT_DELETE_ADMIN');
    }

    const hostProfile = await this.prisma.hostProfile.findUnique({ where: { userId } });
    if (
      hostProfile &&
      (hostProfile.profileType === HostProfileType.AI_HOST ||
        hostProfile.profileType === HostProfileType.MANAGED_HOST)
    ) {
      await this.virtualHosts.adminDelete(userId);
      await this.logAction(adminId, 'user.delete', userId, { hostType: hostProfile.profileType }, ip);
      return { success: true };
    }

    const activeCalls = await this.prisma.call.count({
      where: {
        OR: [{ callerId: userId }, { calleeId: userId }],
        status: { in: [CallStatus.initiated, CallStatus.active] },
      },
    });
    if (activeCalls > 0) {
      throw new BusinessException(
        'Cannot delete user while they have an active call',
        409,
        'USER_HAS_ACTIVE_CALLS',
      );
    }

    await this.setHostOfflineInternal(userId);

    await this.prisma.$transaction(async (tx) => {
      if (hostProfile) {
        await tx.callRoutingSettings.updateMany({
          where: { defaultAiHostId: userId },
          data: { defaultAiHostId: null },
        });
        await tx.virtualHostConversationTurn.deleteMany({ where: { hostId: userId } });
        await tx.virtualHostVoiceSession.deleteMany({ where: { hostId: userId } });
        await tx.virtualHostSession.deleteMany({ where: { hostId: userId } });
        await tx.virtualHostMemory.deleteMany({ where: { hostId: userId } });
        await tx.aIHostMemory.deleteMany({ where: { hostId: userId } });
        await tx.conversationHistory.deleteMany({ where: { hostId: userId } });
        await tx.hostFollower.deleteMany({ where: { hostId: userId } });
        await tx.hostHeartbeat.deleteMany({ where: { userId } });
        await tx.hostApplication.deleteMany({ where: { userId } });
        await tx.hostKyc.deleteMany({ where: { userId } });
        await tx.hostBankAccount.deleteMany({ where: { hostId: userId } });
        await tx.hostProfile.delete({ where: { userId } });
      }

      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.deviceToken.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.block.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      });
      await tx.hostFollower.deleteMany({ where: { userId } });
      await tx.swipe.deleteMany({
        where: { OR: [{ swiperId: userId }, { targetId: userId }] },
      });
      await tx.aIHostMemory.deleteMany({ where: { userId } });
      await tx.conversationHistory.deleteMany({ where: { userId } });
      await tx.virtualHostMemory.deleteMany({ where: { userId } });

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (wallet) {
        await tx.walletTransaction.deleteMany({ where: { userId } });
        await tx.wallet.delete({ where: { userId } });
      }

      await tx.userRole.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          status: UserStatus.deleted,
          sessionRevokedAt: new Date(),
          phone: null,
          email: null,
          displayName: 'Deleted User',
          avatarUrl: null,
          bio: null,
          authIdentity: `deleted_${userId.replace(/-/g, '')}`,
        },
      });
    });

    await this.logAction(adminId, 'user.delete', userId, {}, ip);
    return { success: true };
  }

  async approveHost(adminId: string, userId: string, ip?: string) {
    const application = await this.prisma.hostApplication.findUnique({
      where: { userId },
    });
    if (!application) {
      throw new BusinessException('No host application found', 404, 'NO_APPLICATION');
    }
    await this.usersService.assignRole(userId, Role.host, adminId);
    await this.prisma.hostApplication.update({
      where: { id: application.id },
      data: {
        status: HostApplicationStatus.approved,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    await this.prisma.hostProfile.upsert({
      where: { userId },
      create: { userId, approvedAt: new Date() },
      update: { approvedAt: new Date() },
    });
    await this.logAction(adminId, 'host.approve', userId, {}, ip);
    return { success: true };
  }

  async rejectHost(adminId: string, userId: string, reason?: string, ip?: string) {
    const application = await this.prisma.hostApplication.findUnique({
      where: { userId },
    });
    if (!application) {
      throw new BusinessException('No host application found', 404, 'NO_APPLICATION');
    }
    await this.prisma.hostApplication.update({
      where: { id: application.id },
      data: {
        status: HostApplicationStatus.rejected,
        rejectionReason: reason?.trim() || 'Rejected by admin',
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    await this.logAction(adminId, 'host.reject', userId, { reason }, ip);
    return { success: true };
  }

  private async getOverview() {
    const todayStart = startOfDay(new Date());
    const [
      totalUsers,
      totalHosts,
      verifiedHosts,
      pendingKyc,
      onlineHosts,
      busyHosts,
      offlineHosts,
      suspendedUsers,
      suspendedHosts,
      newUsersToday,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.hostProfile.count(),
      this.prisma.hostKyc.findMany({
        where: { verificationStatus: KycVerificationStatus.verified },
        distinct: ['userId'],
        select: { userId: true },
      }).then((r) => r.length),
      this.prisma.hostKyc.count({
        where: { verificationStatus: { in: PENDING_KYC } },
      }),
      this.prisma.hostProfile.count({ where: { isOnline: true, isBusy: false } }),
      this.prisma.hostProfile.count({ where: { isBusy: true } }),
      this.prisma.hostProfile.count({ where: { isOnline: false } }),
      this.prisma.user.count({ where: { deletedAt: null, status: UserStatus.suspended } }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          status: UserStatus.suspended,
          hostProfile: { isNot: null },
        },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: todayStart } },
      }),
    ]);

    return {
      totalUsers,
      totalHosts,
      verifiedHosts,
      pendingKyc,
      onlineHosts,
      busyHosts,
      offlineHosts,
      suspendedUsers,
      suspendedHosts,
      newUsersToday,
    };
  }

  private async findUsers(query: AdminUsersQueryDto, skip: number, limit: number) {
    const where = this.buildWhere(query);
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        roles: { where: { revokedAt: null }, select: { role: true } },
        wallet: { select: { balanceUnits: true } },
        hostProfile: {
          select: {
            isOnline: true,
            isBusy: true,
            totalCalls: true,
            adminCallsDisabled: true,
            adminWithdrawalsDisabled: true,
          },
        },
        hostKycRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { verificationStatus: true },
        },
      },
    });

    const userIds = users.map((u) => u.id);
    const rechargeMap = await this.getRechargeTotals(userIds);

    return users.map((user) => {
      const roles = user.roles.map((r) => r.role);
      const hostProfile = user.hostProfile;
      const latestKyc = user.hostKycRecords[0];

      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        roles,
        status: user.status,
        onlineStatus: hostProfile
          ? resolveHostStatus(hostProfile.isOnline, hostProfile.isBusy)
          : null,
        kycStatus: latestKyc
          ? kycDisplayStatus(latestKyc.verificationStatus)
          : roles.includes(Role.host)
            ? 'NOT_SUBMITTED'
            : null,
        walletBalanceCoins: user.wallet ? unitsToCoins(user.wallet.balanceUnits) : 0,
        totalRechargeInr: rechargeMap.get(user.id) ?? 0,
        totalCalls: hostProfile?.totalCalls ?? 0,
        adminCallsDisabled: hostProfile?.adminCallsDisabled ?? false,
        adminWithdrawalsDisabled: hostProfile?.adminWithdrawalsDisabled ?? false,
        createdAt: user.createdAt,
      };
    });
  }

  private async countUsers(query: AdminUsersQueryDto) {
    return this.prisma.user.count({ where: this.buildWhere(query) });
  }

  private buildWhere(query: AdminUsersQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (query.q?.trim()) {
      const q = query.q.trim();
      // Never pass non-UUID strings into id (UUID column) — causes Prisma 500
      const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const or: Prisma.UserWhereInput[] = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
      // Digits-only match helps phone search without "+" / spaces
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 4 && digits !== q) {
        or.push({ phone: { contains: digits } });
      }
      if (UUID_RE.test(q)) {
        or.push({ id: q });
      }
      where.OR = or;
    }

    if (query.accountStatus) {
      where.status = query.accountStatus as UserStatus;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = startOfDay(new Date(query.from));
      if (query.to) where.createdAt.lte = endOfDay(new Date(query.to));
    }

    if (query.role === 'host') {
      where.roles = { some: { role: Role.host, revokedAt: null } };
    } else if (query.role === 'admin') {
      where.roles = {
        some: { role: { in: [Role.admin, Role.super_admin] }, revokedAt: null },
      };
    } else if (query.role === 'user') {
      where.roles = { none: { role: { in: [Role.host, Role.admin, Role.super_admin] }, revokedAt: null } };
    }

    if (query.onlineStatus) {
      where.hostProfile = {
        is: query.onlineStatus === 'online'
          ? { isOnline: true, isBusy: false }
          : query.onlineStatus === 'busy'
            ? { isBusy: true }
            : { isOnline: false },
      };
    }

    if (query.kycStatus) {
      if (query.kycStatus === 'none') {
        where.hostKycRecords = { none: {} };
      } else if (query.kycStatus === 'verified') {
        where.hostKycRecords = {
          some: { verificationStatus: KycVerificationStatus.verified },
        };
      } else if (query.kycStatus === 'pending') {
        where.hostKycRecords = {
          some: { verificationStatus: { in: PENDING_KYC } },
        };
      } else if (query.kycStatus === 'rejected') {
        where.hostKycRecords = {
          some: {
            verificationStatus: {
              in: [KycVerificationStatus.failed, KycVerificationStatus.expired],
            },
          },
        };
      }
    }

    return where;
  }

  private async getRechargeTotals(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, number>();
    const rows = await this.prisma.payment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: PaymentStatus.paid },
      _sum: { totalInr: true },
    });
    return new Map(rows.map((r) => [r.userId, decimalToNumber(r._sum.totalInr)]));
  }

  private async setHostOfflineInternal(userId: string) {
    const profile = await this.prisma.hostProfile.findUnique({ where: { userId } });
    if (!profile) return;
    await this.prisma.hostProfile.update({
      where: { userId },
      data: { isOnline: false, isBusy: false, isAvailable: false, lastSeenAt: new Date() },
    });
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }
  }

  private async logAction(
    adminId: string,
    action: string,
    targetUserId: string,
    details?: Record<string, unknown>,
    ip?: string,
  ) {
    await this.prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetUserId,
        details: details as Prisma.InputJsonValue,
        ipAddress: ip ?? null,
      },
    });
  }
}