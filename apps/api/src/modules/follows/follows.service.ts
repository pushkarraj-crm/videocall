import { Injectable } from '@nestjs/common';
import {
  CallHistoryStatus,
  Prisma,
  Role,
  UserStatus,
} from '@prisma/client';
import {
  batchFollowerCounts,
  batchFollowingSet,
  batchVerifiedHosts,
  isUserFollowing,
  singleFollowerCount,
} from '../../common/utils/follow-batch';
import {
  FOLLOW_USER_SELECT,
  growthPercent,
  serializeFavoriteHost,
  serializeFollowerUser,
} from '../../common/utils/follow-display';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AdminFollowersQueryDto } from './dto/admin-followers-query.dto';
import { FavoritesQueryDto } from './dto/favorites-query.dto';

const ACTIVE = { deletedAt: null } as const;

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async follow(userId: string, hostId: string) {
    await this.validateCanFollow(userId, hostId);

    const existing = await this.prisma.hostFollower.findUnique({
      where: { hostId_userId: { hostId, userId } },
    });

    if (existing && !existing.deletedAt) {
      throw new BusinessException('Already following this host', 409, 'DUPLICATE_FOLLOW');
    }

    const row = existing
      ? await this.prisma.hostFollower.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        })
      : await this.prisma.hostFollower.create({
          data: { hostId, userId },
        });

    const followerCount = await singleFollowerCount(this.prisma, hostId);

    return {
      following: true,
      followId: row.id,
      hostId,
      followerCount,
      createdAt: row.createdAt,
    };
  }

  async unfollow(userId: string, hostId: string) {
    const existing = await this.prisma.hostFollower.findUnique({
      where: { hostId_userId: { hostId, userId } },
    });

    if (!existing || existing.deletedAt) {
      throw new BusinessException('Not following this host', 404, 'NOT_FOLLOWING');
    }

    await this.prisma.hostFollower.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    const followerCount = await singleFollowerCount(this.prisma, hostId);

    return { following: false, hostId, followerCount };
  }

  async getFavorites(userId: string, query: FavoritesQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.HostFollowerWhereInput = {
      userId,
      ...ACTIVE,
    };

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.host = {
        displayName: { contains: q, mode: 'insensitive' },
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.hostFollower.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          host: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              gender: true,
              primaryLanguage: true,
              hostProfile: true,
            },
          },
        },
      }),
      this.prisma.hostFollower.count({ where }),
    ]);

    const hostIds = rows
      .map((r) => r.host.hostProfile?.userId ?? r.hostId)
      .filter((id): id is string => Boolean(id));

    const [counts, verified] = await Promise.all([
      batchFollowerCounts(this.prisma, hostIds),
      batchVerifiedHosts(this.prisma, hostIds),
    ]);

    let items = rows
      .filter((r) => r.host.hostProfile)
      .map((r) => {
        const profile = r.host.hostProfile!;
        return serializeFavoriteHost(
          {
            userId: profile.userId,
            isOnline: profile.isOnline,
            isBusy: profile.isBusy,
            lastSeenAt: profile.lastSeenAt,
            languages: profile.languages,
            totalCalls: profile.totalCalls,
            ratingSum: profile.ratingSum,
            ratingCount: profile.ratingCount,
            user: {
              id: r.host.id,
              displayName: r.host.displayName,
              avatarUrl: r.host.avatarUrl,
              bio: r.host.bio,
              gender: r.host.gender,
              primaryLanguage: r.host.primaryLanguage,
            },
          },
          {
            followerCount: counts.get(profile.userId) ?? 0,
            isVerified: verified.has(profile.userId),
            isFollowing: true,
            followedAt: r.createdAt,
          },
        );
      });

    if (query.sort === 'rating') {
      items = items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (query.sort === 'online') {
      items = items.sort((a, b) => {
        const score = (h: typeof a) =>
          h.status === 'ONLINE' ? 2 : h.status === 'BUSY' ? 1 : 0;
        return score(b) - score(a);
      });
    }

    return { items, total, page, limit };
  }

  async getHostFollowersSummary(hostId: string) {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const baseWhere = { hostId, ...ACTIVE };

    const [
      totalFollowers,
      followersThisWeek,
      followersThisMonth,
      followersPrevMonth,
      recentFollowers,
      repeatCallers,
      dailyCounts,
    ] = await Promise.all([
      this.prisma.hostFollower.count({ where: baseWhere }),
      this.prisma.hostFollower.count({
        where: { ...baseWhere, createdAt: { gte: weekStart } },
      }),
      this.prisma.hostFollower.count({
        where: { ...baseWhere, createdAt: { gte: monthStart } },
      }),
      this.prisma.hostFollower.count({
        where: {
          ...baseWhere,
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
      }),
      this.prisma.hostFollower.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: FOLLOW_USER_SELECT } },
      }),
      this.prisma.callHistory
        .groupBy({
          by: ['callerId'],
          where: { hostId, status: CallHistoryStatus.completed },
          _count: true,
        })
        .then((rows) => rows.filter((r) => r._count > 1)),
      this.getDailyFollowerCounts(hostId, 7),
    ]);

    const recentUserIds = recentFollowers.map((r) => r.userId);
    const callCounts = recentUserIds.length
      ? await this.prisma.callHistory.groupBy({
          by: ['callerId'],
          where: {
            hostId,
            callerId: { in: recentUserIds },
            status: CallHistoryStatus.completed,
          },
          _count: true,
        })
      : [];
    const callCountMap = new Map(callCounts.map((c) => [c.callerId, c._count]));

    const topFollowers = [...recentFollowers]
      .map((r) => serializeFollowerUser(r, callCountMap.get(r.userId) ?? 0))
      .sort((a, b) => b.completedCalls - a.completedCalls)
      .slice(0, 5);

    return {
      totalFollowers,
      followersThisWeek,
      followersThisMonth,
      repeatUsers: repeatCallers.length,
      growthPercent: growthPercent(followersThisMonth, followersPrevMonth),
      recentFollowers: recentFollowers.map((r) =>
        serializeFollowerUser(r, callCountMap.get(r.userId) ?? 0),
      ),
      topFollowers,
      dailyChart: dailyCounts,
    };
  }

  async getPublicFollowStats(viewerId: string, hostId: string) {
    const [followerCount, isFollowing] = await Promise.all([
      singleFollowerCount(this.prisma, hostId),
      isUserFollowing(this.prisma, viewerId, hostId),
    ]);
    return { followerCount, isFollowing };
  }

  async enrichDiscoverHosts(
    hosts: Array<{ userId: string; [key: string]: unknown }>,
    viewerId?: string,
  ) {
    const hostIds = hosts.map((h) => h.userId);
    const [counts, following, verified] = await Promise.all([
      batchFollowerCounts(this.prisma, hostIds),
      viewerId ? batchFollowingSet(this.prisma, viewerId, hostIds) : Promise.resolve(new Set<string>()),
      batchVerifiedHosts(this.prisma, hostIds),
    ]);

    return hosts.map((host) => ({
      ...host,
      followerCount: counts.get(host.userId) ?? 0,
      isFollowing: viewerId ? following.has(host.userId) : false,
      isVerified: verified.has(host.userId) ?? (host as { isVerified?: boolean }).isVerified,
    }));
  }

  private async validateCanFollow(userId: string, hostId: string) {
    if (userId === hostId) {
      throw new BusinessException('Cannot follow yourself', 400, 'SELF_FOLLOW');
    }

    const hostRoles = await this.usersService.getUserRoles(hostId);
    if (!hostRoles.includes(Role.host)) {
      throw new BusinessException('User is not a host', 404, 'NOT_A_HOST');
    }

    const hostUser = await this.prisma.user.findFirst({
      where: { id: hostId, deletedAt: null },
      select: { status: true },
    });
    if (!hostUser || hostUser.status !== UserStatus.active) {
      throw new BusinessException('Host not available', 404, 'HOST_NOT_FOUND');
    }

    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: hostId },
          { blockerId: hostId, blockedId: userId },
        ],
      },
    });
    if (blocked) {
      throw new BusinessException('Cannot follow this host', 403, 'BLOCKED');
    }
  }

  private async getDailyFollowerCounts(hostId: string, days: number) {
    const result: Array<{ date: string; count: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await this.prisma.hostFollower.count({
        where: {
          hostId,
          ...ACTIVE,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });

      result.push({
        date: dayStart.toISOString().slice(0, 10),
        count,
      });
    }

    return result;
  }
}