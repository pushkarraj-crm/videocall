import { Injectable } from '@nestjs/common';
import { Prisma, ReferralStatus } from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import {
  getReferralProgramConfig,
  saveReferralProgramConfig,
  type ReferralProgramConfig,
} from '../../common/utils/referral-config';
import {
  REFERRAL_USER_SELECT,
  referralDisplayStatus,
  serializeReferral,
} from '../../common/utils/referral-display';
import { PrismaService } from '../../database/prisma.service';
import { AdminReferralsQueryDto } from './dto/admin-referrals-query.dto';

@Injectable()
export class ReferralsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listReferrals(query: AdminReferralsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.ReferralWhereInput = {};

    if (query.status) {
      const map: Record<string, ReferralStatus> = {
        PENDING: ReferralStatus.pending,
        COMPLETED: ReferralStatus.qualified,
        REWARDED: ReferralStatus.rewarded,
        CANCELLED: ReferralStatus.rejected,
      };
      if (map[query.status]) where.status = map[query.status];
    }

    if (query.referrerId) where.referrerId = query.referrerId;
    if (query.referredUserId) where.referredId = query.referredUserId;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { referralCode: { contains: q, mode: 'insensitive' } },
        { referrer: { displayName: { contains: q, mode: 'insensitive' } } },
        { referred: { displayName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [rows, total, analytics] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          referrer: { select: REFERRAL_USER_SELECT },
          referred: { select: REFERRAL_USER_SELECT },
        },
      }),
      this.prisma.referral.count({ where }),
      this.getAnalytics(),
    ]);

    return {
      items: rows.map((r) => serializeReferral(r)),
      total,
      page,
      limit,
      analytics,
    };
  }

  async exportCsv(query: AdminReferralsQueryDto) {
    const result = await this.listReferrals({ ...query, page: 1, limit: 50 });
    const header = [
      'id',
      'referralCode',
      'referrer',
      'referredUser',
      'status',
      'rewardGiven',
      'createdAt',
      'completedAt',
      'rewardedAt',
    ];
    const lines = [
      header.join(','),
      ...result.items.map((r) =>
        [
          r.id,
          r.referralCode,
          r.referrer?.displayName ?? r.referrerId,
          r.referredUser?.displayName ?? r.referredUserId,
          r.displayStatus,
          r.rewardGiven,
          r.createdAt,
          r.completedAt ?? '',
          r.rewardedAt ?? '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    return { csv: lines.join('\n'), count: result.items.length };
  }

  async getAnalytics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const [total, pending, completed, rewarded, cancelled, today, month, yesterday, topReferrers, topEarners] =
      await Promise.all([
        this.prisma.referral.count(),
        this.prisma.referral.count({ where: { status: ReferralStatus.pending } }),
        this.prisma.referral.count({ where: { status: ReferralStatus.qualified } }),
        this.prisma.referral.count({ where: { status: ReferralStatus.rewarded } }),
        this.prisma.referral.count({ where: { status: ReferralStatus.rejected } }),
        this.prisma.referral.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.referral.count({ where: { createdAt: { gte: monthStart } } }),
        this.prisma.referral.count({
          where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
        }),
        this.prisma.referral.groupBy({
          by: ['referrerId'],
          where: { status: ReferralStatus.rewarded },
          _count: true,
          orderBy: { _count: { referrerId: 'desc' } },
          take: 10,
        }),
        this.prisma.referral.groupBy({
          by: ['referrerId'],
          where: { status: ReferralStatus.rewarded },
          _sum: { referrerRewardUnits: true },
          orderBy: { _sum: { referrerRewardUnits: 'desc' } },
          take: 10,
        }),
      ]);

    const userIds = [
      ...new Set([
        ...topReferrers.map((r) => r.referrerId),
        ...topEarners.map((r) => r.referrerId),
      ]),
    ];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, displayName: true, avatarUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const rewardAgg = await this.prisma.referral.aggregate({
      where: { status: ReferralStatus.rewarded },
      _sum: {
        referrerRewardUnits: true,
        referredRewardUnits: true,
      },
    });
    const totalRewardUnits =
      (rewardAgg._sum.referrerRewardUnits ?? 0n) +
      (rewardAgg._sum.referredRewardUnits ?? 0n);

    return {
      totalReferrals: total,
      pendingReferrals: pending,
      successfulReferrals: rewarded,
      completedReferrals: completed,
      cancelledReferrals: cancelled,
      rewardAmountCoins: unitsToCoins(totalRewardUnits),
      conversionRate: total > 0 ? Math.round((rewarded / total) * 100) : 0,
      referralsToday: today,
      referralsThisMonth: month,
      dailyGrowth: today - yesterday,
      monthlyGrowthPercent:
        month > 0 && total > month
          ? Math.round((month / (total - month)) * 100)
          : month > 0
            ? 100
            : 0,
      topReferrers: topReferrers.map((r) => ({
        userId: r.referrerId,
        displayName: userMap.get(r.referrerId)?.displayName ?? 'Unknown',
        avatarUrl: userMap.get(r.referrerId)?.avatarUrl ?? null,
        successfulReferrals: r._count,
      })),
      topEarners: topEarners.map((r) => ({
        userId: r.referrerId,
        displayName: userMap.get(r.referrerId)?.displayName ?? 'Unknown',
        avatarUrl: userMap.get(r.referrerId)?.avatarUrl ?? null,
        earningsCoins: unitsToCoins(r._sum.referrerRewardUnits ?? 0n),
      })),
    };
  }

  async getSettings() {
    return getReferralProgramConfig(this.prisma);
  }

  async updateSettings(config: ReferralProgramConfig, adminId: string) {
    await saveReferralProgramConfig(this.prisma, config, adminId);
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'referral.settings_update',
        entityType: 'platform_config',
        entityId: null,
        newValue: config as unknown as Prisma.InputJsonValue,
      },
    });
    return config;
  }
}