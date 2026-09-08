import { Injectable } from '@nestjs/common';
import { GiftCategory, Prisma } from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { BusinessException } from '../../common/exceptions/business.exception';
import {
  resolveLegacyGift,
  resolvedFromCatalog,
  serializeGiftCatalogItem,
  type ResolvedGift,
} from '../../common/utils/gift-catalog';
import { PrismaService } from '../../database/prisma.service';
import { CreateGiftCatalogDto, UpdateGiftCatalogDto } from './dto/admin-gift.dto';

type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

@Injectable()
export class GiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveGift(slug: string): Promise<ResolvedGift> {
    const row = await this.prisma.giftCatalogItem.findFirst({
      where: { slug, isEnabled: true },
    });
    if (row) return resolvedFromCatalog(row);

    const legacy = resolveLegacyGift(slug);
    if (legacy) return legacy;

    throw new BusinessException('Unknown gift', 400, 'INVALID_GIFT');
  }

  async getCatalog(opts?: { category?: GiftCategory; featured?: boolean; trending?: boolean }) {
    const where: Prisma.GiftCatalogItemWhereInput = { isEnabled: true };
    if (opts?.category) where.category = opts.category;
    if (opts?.featured) where.isFeatured = true;
    if (opts?.trending) where.isTrending = true;

    const items = await this.prisma.giftCatalogItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { popularity: 'desc' }],
    });

    return {
      items: items.map(serializeGiftCatalogItem),
      categories: ['basic', 'premium', 'luxury', 'vip'] as const,
    };
  }

  async getCallGiftFeed(callId: string, since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);
    const gifts = await this.prisma.callGift.findMany({
      where: { callId, createdAt: { gt: sinceDate } },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        catalogGift: true,
      },
    });

    return {
      gifts: gifts.map((g) => this.serializeCallGiftEvent(g)),
    };
  }

  serializeCallGiftEvent(g: {
    id: string;
    giftType: string;
    quantity: number;
    coinUnits: bigint;
    hostEarningUnits: bigint;
    createdAt: Date;
    sender: { id: string; displayName: string; avatarUrl: string | null };
    catalogGift: {
      name: string;
      icon: string;
      animationTier: string;
      animationKey: string;
      category: string;
    } | null;
  }) {
    return {
      id: g.id,
      giftId: g.giftType,
      quantity: g.quantity,
      coinCoins: unitsToCoins(g.coinUnits),
      hostEarningCoins: unitsToCoins(g.hostEarningUnits),
      createdAt: g.createdAt.toISOString(),
      sender: g.sender,
      gift: g.catalogGift
        ? {
            name: g.catalogGift.name,
            icon: g.catalogGift.icon,
            animationTier: g.catalogGift.animationTier,
            animationKey: g.catalogGift.animationKey,
            category: g.catalogGift.category,
          }
        : {
            name: g.giftType,
            icon: '🎁',
            animationTier: 'floating',
            animationKey: 'floating_float',
            category: 'basic',
          },
    };
  }

  async getUserGiftHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.callGift.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          recipient: { select: { id: true, displayName: true, avatarUrl: true } },
          catalogGift: true,
        },
      }),
      this.prisma.callGift.count({ where: { senderId: userId } }),
    ]);

    return {
      items: items.map((g) => ({
        id: g.id,
        giftId: g.giftType,
        quantity: g.quantity,
        coinCoins: unitsToCoins(g.coinUnits),
        status: 'delivered',
        createdAt: g.createdAt.toISOString(),
        recipient: g.recipient,
        gift: g.catalogGift
          ? { name: g.catalogGift.name, icon: g.catalogGift.icon, animationKey: g.catalogGift.animationKey }
          : { name: g.giftType, icon: '🎁', animationKey: 'floating_float' },
      })),
      total,
      page,
      limit,
    };
  }

  async getUserGiftStats(userId: string) {
    const sent = await this.prisma.callGift.groupBy({
      by: ['giftType'],
      where: { senderId: userId },
      _sum: { coinUnits: true, quantity: true },
      _count: { id: true },
    });

    const totalSpent = sent.reduce((acc, row) => acc + (row._sum.coinUnits ?? 0n), 0n);
    const favorite = sent.sort((a, b) => Number(b._count.id) - Number(a._count.id))[0];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthly = await this.prisma.callGift.aggregate({
      where: { senderId: userId, createdAt: { gte: monthStart } },
      _sum: { coinUnits: true },
      _count: { id: true },
    });

    let favoriteGift = null;
    if (favorite) {
      const catalog = await this.prisma.giftCatalogItem.findFirst({
        where: { slug: favorite.giftType },
      });
      favoriteGift = catalog
        ? { slug: catalog.slug, name: catalog.name, icon: catalog.icon, count: favorite._count.id }
        : { slug: favorite.giftType, name: favorite.giftType, icon: '🎁', count: favorite._count.id };
    }

    return {
      totalGiftsSent: sent.reduce((acc, r) => acc + r._count.id, 0),
      totalCoinsSpent: unitsToCoins(totalSpent),
      monthlyCoinsSpent: unitsToCoins(monthly._sum.coinUnits ?? 0n),
      monthlyGiftCount: monthly._count.id,
      favoriteGift,
    };
  }

  async getHostGiftStats(hostId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [today, allTime, topGiftRows, topSenderRows] = await Promise.all([
      this.prisma.callGift.aggregate({
        where: { recipientId: hostId, createdAt: { gte: todayStart } },
        _sum: { coinUnits: true, hostEarningUnits: true },
        _count: { id: true },
      }),
      this.prisma.callGift.aggregate({
        where: { recipientId: hostId },
        _sum: { coinUnits: true, hostEarningUnits: true },
        _count: { id: true },
      }),
      this.prisma.callGift.groupBy({
        by: ['giftType'],
        where: { recipientId: hostId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
      this.prisma.callGift.groupBy({
        by: ['senderId'],
        where: { recipientId: hostId },
        _sum: { coinUnits: true },
        orderBy: { _sum: { coinUnits: 'desc' } },
        take: 1,
      }),
    ]);

    const mostReceived = topGiftRows[0];
    let mostReceivedGift = null;
    if (mostReceived) {
      const catalog = await this.prisma.giftCatalogItem.findFirst({
        where: { slug: mostReceived.giftType },
      });
      mostReceivedGift = catalog
        ? { slug: catalog.slug, name: catalog.name, icon: catalog.icon, count: mostReceived._count.id }
        : { slug: mostReceived.giftType, name: mostReceived.giftType, icon: '🎁', count: mostReceived._count.id };
    }

    let topSender = null;
    if (topSenderRows[0]) {
      const user = await this.prisma.user.findUnique({
        where: { id: topSenderRows[0].senderId },
        select: { id: true, displayName: true, avatarUrl: true },
      });
      topSender = user
        ? {
            ...user,
            totalCoins: unitsToCoins(topSenderRows[0]._sum.coinUnits ?? 0n),
          }
        : null;
    }

    const recent = await this.prisma.callGift.findMany({
      where: { recipientId: hostId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        sender: { select: { displayName: true } },
        catalogGift: { select: { name: true, icon: true } },
      },
    });

    return {
      todayGifts: today._count.id,
      todayCoins: unitsToCoins(today._sum.coinUnits ?? 0n),
      todayEarnings: unitsToCoins(today._sum.hostEarningUnits ?? 0n),
      totalGifts: allTime._count.id,
      totalCoins: unitsToCoins(allTime._sum.coinUnits ?? 0n),
      totalEarnings: unitsToCoins(allTime._sum.hostEarningUnits ?? 0n),
      mostReceivedGift,
      topSender,
      recentGifts: recent.map((g) => ({
        id: g.id,
        giftName: g.catalogGift?.name ?? g.giftType,
        icon: g.catalogGift?.icon ?? '🎁',
        quantity: g.quantity,
        coins: unitsToCoins(g.coinUnits),
        senderName: g.sender.displayName,
        createdAt: g.createdAt.toISOString(),
      })),
    };
  }

  private periodStart(period: LeaderboardPeriod): Date | null {
    if (period === 'all_time') return null;
    const now = new Date();
    if (period === 'daily') {
      now.setHours(0, 0, 0, 0);
      return now;
    }
    if (period === 'weekly') {
      now.setDate(now.getDate() - 7);
      return now;
    }
    now.setMonth(now.getMonth() - 1);
    return now;
  }

  async getLeaderboard(period: LeaderboardPeriod = 'weekly') {
    const since = this.periodStart(period);
    const where = since ? { createdAt: { gte: since } } : {};

    const [topGifters, topHosts] = await Promise.all([
      this.prisma.callGift.groupBy({
        by: ['senderId'],
        where,
        _sum: { coinUnits: true },
        _count: { id: true },
        orderBy: { _sum: { coinUnits: 'desc' } },
        take: 20,
      }),
      this.prisma.callGift.groupBy({
        by: ['recipientId'],
        where,
        _sum: { hostEarningUnits: true },
        _count: { id: true },
        orderBy: { _sum: { hostEarningUnits: 'desc' } },
        take: 20,
      }),
    ]);

    const userIds = [
      ...new Set([
        ...topGifters.map((r) => r.senderId),
        ...topHosts.map((r) => r.recipientId),
      ]),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      period,
      topGifters: topGifters.map((row, i) => ({
        rank: i + 1,
        user: userMap.get(row.senderId),
        giftCount: row._count.id,
        totalCoins: unitsToCoins(row._sum.coinUnits ?? 0n),
      })),
      topHosts: topHosts.map((row, i) => ({
        rank: i + 1,
        user: userMap.get(row.recipientId),
        giftCount: row._count.id,
        totalEarnings: unitsToCoins(row._sum.hostEarningUnits ?? 0n),
      })),
    };
  }

  async getAdminAnalytics() {
    const [popular, revenue, totals] = await Promise.all([
      this.prisma.callGift.groupBy({
        by: ['giftType'],
        _count: { id: true },
        _sum: { coinUnits: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.callGift.aggregate({
        _sum: { coinUnits: true, platformFeeUnits: true },
        _count: { id: true },
        _avg: { coinUnits: true },
      }),
      this.prisma.callGift.count(),
    ]);

    const slugs = popular.map((p) => p.giftType);
    const catalog = await this.prisma.giftCatalogItem.findMany({
      where: { slug: { in: slugs } },
    });
    const catalogMap = new Map(catalog.map((c) => [c.slug, c]));

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCount = await this.prisma.callGift.count({
      where: { createdAt: { gte: monthStart } },
    });

    return {
      totalGiftsSent: totals,
      giftRevenueCoins: unitsToCoins(revenue._sum.coinUnits ?? 0n),
      platformFeeCoins: unitsToCoins(revenue._sum.platformFeeUnits ?? 0n),
      averageGiftValueCoins: revenue._avg.coinUnits
        ? unitsToCoins(BigInt(Math.round(revenue._avg.coinUnits)))
        : 0,
      monthlyGiftCount: monthCount,
      mostPopular: popular.map((p) => ({
        giftId: p.giftType,
        name: catalogMap.get(p.giftType)?.name ?? p.giftType,
        icon: catalogMap.get(p.giftType)?.icon ?? '🎁',
        count: p._count.id,
        revenueCoins: unitsToCoins(p._sum.coinUnits ?? 0n),
      })),
    };
  }

  async adminList() {
    const items = await this.prisma.giftCatalogItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return items.map(serializeGiftCatalogItem);
  }

  async adminCreate(dto: CreateGiftCatalogDto) {
    const existing = await this.prisma.giftCatalogItem.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new BusinessException('Gift slug already exists', 409, 'DUPLICATE_GIFT');
    }
    const row = await this.prisma.giftCatalogItem.create({ data: dto });
    return serializeGiftCatalogItem(row);
  }

  async adminUpdate(id: string, dto: UpdateGiftCatalogDto) {
    const row = await this.prisma.giftCatalogItem.update({ where: { id }, data: dto });
    return serializeGiftCatalogItem(row);
  }

  async adminDelete(id: string) {
    await this.prisma.giftCatalogItem.update({
      where: { id },
      data: { isEnabled: false },
    });
    return { deleted: true };
  }
}