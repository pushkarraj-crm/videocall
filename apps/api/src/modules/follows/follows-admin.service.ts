import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { averageRating } from '../../common/utils/host-rating-stats';
import {
  FOLLOW_USER_SELECT,
  serializeFollowerUser,
} from '../../common/utils/follow-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { AdminFollowersQueryDto } from './dto/admin-followers-query.dto';

const ACTIVE = { deletedAt: null } as const;

@Injectable()
export class FollowsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listFollows(query: AdminFollowersQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.HostFollowerWhereInput = { ...ACTIVE };

    if (query.hostId) where.hostId = query.hostId;
    if (query.userId) where.userId = query.userId;

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
        { user: { displayName: { contains: q, mode: 'insensitive' } } },
        { host: { displayName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.hostFollower.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: FOLLOW_USER_SELECT },
          host: { select: FOLLOW_USER_SELECT },
        },
      }),
      this.prisma.hostFollower.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        ...serializeFollowerUser(r),
        host: r.host,
      })),
      total,
      page,
      limit,
    };
  }

  async getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalFollows,
      totalUnfollows,
      followersToday,
      followersThisMonth,
      hostRankings,
      avgAgg,
      timeline,
      fastestGrowing,
    ] = await Promise.all([
      this.prisma.hostFollower.count({ where: ACTIVE }),
      this.prisma.hostFollower.count({ where: { deletedAt: { not: null } } }),
      this.prisma.hostFollower.count({
        where: { ...ACTIVE, createdAt: { gte: todayStart } },
      }),
      this.prisma.hostFollower.count({
        where: { ...ACTIVE, createdAt: { gte: monthStart } },
      }),
      this.prisma.hostFollower.groupBy({
        by: ['hostId'],
        where: ACTIVE,
        _count: true,
        orderBy: { _count: { hostId: 'desc' } },
        take: 10,
      }),
      this.prisma.hostFollower.groupBy({
        by: ['hostId'],
        where: ACTIVE,
        _count: true,
      }),
      this.getTimeline(30),
      this.getFastestGrowing(weekAgo),
    ]);

    const hostIds = [
      ...new Set([
        ...hostRankings.map((r) => r.hostId),
        ...fastestGrowing.map((r) => r.hostId),
      ]),
    ];
    const hosts = hostIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: hostIds } },
          select: FOLLOW_USER_SELECT,
        })
      : [];
    const hostMap = new Map(hosts.map((h) => [h.id, h]));

    const profiles = hostIds.length
      ? await this.prisma.hostProfile.findMany({
          where: { userId: { in: hostIds } },
          select: { userId: true, ratingSum: true, ratingCount: true },
        })
      : [];
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const averageFollowers =
      avgAgg.length > 0
        ? Math.round(
            avgAgg.reduce((sum, r) => sum + r._count, 0) / avgAgg.length,
          )
        : 0;

    const topHost = hostRankings[0];

    return {
      totalFollows,
      totalUnfollows,
      followersToday,
      followersThisMonth,
      averageFollowers,
      mostFollowedHost: topHost
        ? {
            hostId: topHost.hostId,
            displayName: hostMap.get(topHost.hostId)?.displayName ?? 'Unknown',
            avatarUrl: hostMap.get(topHost.hostId)?.avatarUrl ?? null,
            followerCount: topHost._count,
            averageRating: profileMap.has(topHost.hostId)
              ? averageRating(
                  profileMap.get(topHost.hostId)!.ratingSum,
                  profileMap.get(topHost.hostId)!.ratingCount,
                )
              : null,
          }
        : null,
      topHosts: hostRankings.map((r) => ({
        hostId: r.hostId,
        displayName: hostMap.get(r.hostId)?.displayName ?? 'Unknown',
        avatarUrl: hostMap.get(r.hostId)?.avatarUrl ?? null,
        followerCount: r._count,
        averageRating: profileMap.has(r.hostId)
          ? averageRating(
              profileMap.get(r.hostId)!.ratingSum,
              profileMap.get(r.hostId)!.ratingCount,
            )
          : null,
      })),
      fastestGrowingHosts: fastestGrowing.map((r) => ({
        hostId: r.hostId,
        displayName: hostMap.get(r.hostId)?.displayName ?? 'Unknown',
        avatarUrl: hostMap.get(r.hostId)?.avatarUrl ?? null,
        newFollowers: r._count,
      })),
      timeline,
    };
  }

  async removeFakeFollow(followId: string) {
    const existing = await this.prisma.hostFollower.findUnique({
      where: { id: followId },
    });
    if (!existing || existing.deletedAt) {
      throw new BusinessException('Follow record not found', 404, 'FOLLOW_NOT_FOUND');
    }

    await this.prisma.hostFollower.update({
      where: { id: followId },
      data: { deletedAt: new Date() },
    });

    return { removed: true, id: followId };
  }

  private async getTimeline(days: number) {
    const result: Array<{ date: string; follows: number; unfollows: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [follows, unfollows] = await Promise.all([
        this.prisma.hostFollower.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd }, deletedAt: null },
        }),
        this.prisma.hostFollower.count({
          where: { deletedAt: { gte: dayStart, lt: dayEnd } },
        }),
      ]);

      result.push({
        date: dayStart.toISOString().slice(0, 10),
        follows,
        unfollows,
      });
    }

    return result;
  }

  private async getFastestGrowing(since: Date) {
    return this.prisma.hostFollower.groupBy({
      by: ['hostId'],
      where: { ...ACTIVE, createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { hostId: 'desc' } },
      take: 10,
    });
  }
}