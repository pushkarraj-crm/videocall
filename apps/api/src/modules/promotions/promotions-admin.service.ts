import { Injectable } from '@nestjs/common';
import { Prisma, PromoCampaignType, PromoUsageStatus } from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { BusinessException } from '../../common/exceptions/business.exception';
import { serializePromoCode } from '../../common/utils/promo-display';
import { PrismaService } from '../../database/prisma.service';
import { AdminPromotionsQueryDto } from './dto/admin-promotions-query.dto';
import { CreatePromoDto } from './dto/create-promo.dto';

@Injectable()
export class PromotionsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminPromotionsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);

    const [rows, total, analytics] = await Promise.all([
      this.prisma.promoCode.findMany({
        where,
        orderBy: this.buildOrder(query.sort),
        skip,
        take: limit,
        include: { campaign: true },
      }),
      this.prisma.promoCode.count({ where }),
      this.getAnalytics(),
    ]);

    return {
      items: rows.map((r) => serializePromoCode(r)),
      total,
      page,
      limit,
      analytics,
    };
  }

  async create(dto: CreatePromoDto, adminId: string) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.promoCode.findUnique({ where: { code } });
    if (existing) {
      throw new BusinessException('Coupon code already exists', 409, 'DUPLICATE_CODE');
    }

    const promo = await this.prisma.promoCode.create({
      data: {
        code,
        title: dto.title,
        description: dto.description,
        campaignType: dto.campaignType,
        discountType: dto.discountType,
        discountValue: dto.discountValue ?? 0,
        maxDiscount: dto.maxDiscount,
        minimumRecharge: dto.minimumRecharge ?? 0,
        bonusCoins: dto.bonusCoins ?? 0,
        cashbackCoins: dto.cashbackCoins ?? 0,
        usageLimit: dto.usageLimit,
        usagePerUser: dto.usagePerUser ?? 1,
        visibility: dto.visibility,
        campaignId: dto.campaignId,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: { campaign: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'promo.created',
        entityType: 'promo_code',
        entityId: promo.id,
        newValue: { code: promo.code },
      },
    });

    return serializePromoCode(promo);
  }

  async update(id: string, dto: Partial<CreatePromoDto>, adminId: string) {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException('Coupon not found', 404, 'PROMO_NOT_FOUND');
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const dup = await this.prisma.promoCode.findFirst({
        where: { code, NOT: { id } },
      });
      if (dup) {
        throw new BusinessException('Coupon code already exists', 409, 'DUPLICATE_CODE');
      }
    }

    const promo = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.title != null ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.campaignType != null ? { campaignType: dto.campaignType } : {}),
        ...(dto.discountType != null ? { discountType: dto.discountType } : {}),
        ...(dto.discountValue != null ? { discountValue: dto.discountValue } : {}),
        ...(dto.maxDiscount !== undefined ? { maxDiscount: dto.maxDiscount } : {}),
        ...(dto.minimumRecharge != null ? { minimumRecharge: dto.minimumRecharge } : {}),
        ...(dto.bonusCoins != null ? { bonusCoins: dto.bonusCoins } : {}),
        ...(dto.cashbackCoins != null ? { cashbackCoins: dto.cashbackCoins } : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        ...(dto.usagePerUser != null ? { usagePerUser: dto.usagePerUser } : {}),
        ...(dto.visibility != null ? { visibility: dto.visibility } : {}),
        ...(dto.campaignId !== undefined ? { campaignId: dto.campaignId } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
      },
      include: { campaign: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'promo.updated',
        entityType: 'promo_code',
        entityId: id,
      },
    });

    return serializePromoCode(promo);
  }

  async clone(id: string, adminId: string) {
    const source = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!source) {
      throw new BusinessException('Coupon not found', 404, 'PROMO_NOT_FOUND');
    }

    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${source.code.slice(0, 20)}_${suffix}`;

    const promo = await this.prisma.promoCode.create({
      data: {
        code,
        title: `${source.title} (Copy)`,
        description: source.description,
        campaignType: source.campaignType,
        discountType: source.discountType,
        discountValue: source.discountValue,
        maxDiscount: source.maxDiscount,
        minimumRecharge: source.minimumRecharge,
        bonusCoins: source.bonusCoins,
        cashbackCoins: source.cashbackCoins,
        usageLimit: source.usageLimit,
        usagePerUser: source.usagePerUser,
        visibility: source.visibility,
        campaignId: source.campaignId,
        isActive: false,
        startsAt: source.startsAt,
        expiresAt: source.expiresAt,
      },
      include: { campaign: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'promo.cloned',
        entityType: 'promo_code',
        entityId: promo.id,
        newValue: { sourceId: id },
      },
    });

    return serializePromoCode(promo);
  }

  async remove(id: string, adminId: string) {
    const usageCount = await this.prisma.promoUsage.count({
      where: { promoId: id, status: { not: PromoUsageStatus.cancelled } },
    });
    if (usageCount > 0) {
      await this.prisma.promoCode.update({
        where: { id },
        data: { isActive: false },
      });
      return { deactivated: true };
    }

    await this.prisma.promoCode.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'promo.deleted',
        entityType: 'promo_code',
        entityId: id,
      },
    });
    return { deleted: true };
  }

  async bulkAction(ids: string[], action: 'activate' | 'deactivate' | 'delete', adminId: string) {
    if (action === 'delete') {
      for (const id of ids) {
        await this.remove(id, adminId);
      }
      return { processed: ids.length, action };
    }

    await this.prisma.promoCode.updateMany({
      where: { id: { in: ids } },
      data: { isActive: action === 'activate' },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: `promo.bulk_${action}`,
        entityType: 'promo_code',
        entityId: null,
        newValue: { ids },
      },
    });

    return { processed: ids.length, action };
  }

  async exportCsv(query: AdminPromotionsQueryDto) {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const header = [
      'id',
      'code',
      'title',
      'campaignType',
      'discountType',
      'discountValue',
      'bonusCoins',
      'cashbackCoins',
      'currentUsage',
      'usageLimit',
      'isActive',
      'expiresAt',
    ];
    const lines = [
      header.join(','),
      ...result.items.map((p) =>
        [
          p.id,
          p.code,
          `"${p.title.replace(/"/g, '""')}"`,
          p.campaignType,
          p.discountType,
          p.discountValue,
          p.bonusCoins,
          p.cashbackCoins,
          p.currentUsage,
          p.usageLimit ?? '',
          p.isActive,
          p.expiresAt ?? '',
        ].join(','),
      ),
    ];
    return { csv: lines.join('\n'), count: result.items.length };
  }

  async getAnalytics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCoupons,
      activeCoupons,
      usages,
      todayUsages,
      weekUsages,
      monthUsages,
      topCoupons,
      abuseCount,
    ] = await Promise.all([
      this.prisma.promoCode.count(),
      this.prisma.promoCode.count({ where: { isActive: true } }),
      this.prisma.promoUsage.findMany({
        where: { status: { not: PromoUsageStatus.cancelled } },
        select: {
          amount: true,
          discountApplied: true,
          bonusCoinsGiven: true,
          cashbackCoinsGiven: true,
          promoId: true,
        },
      }),
      this.prisma.promoUsage.count({
        where: { createdAt: { gte: todayStart }, status: { not: PromoUsageStatus.cancelled } },
      }),
      this.prisma.promoUsage.count({
        where: { createdAt: { gte: weekStart }, status: { not: PromoUsageStatus.cancelled } },
      }),
      this.prisma.promoUsage.count({
        where: { createdAt: { gte: monthStart }, status: { not: PromoUsageStatus.cancelled } },
      }),
      this.prisma.promoUsage.groupBy({
        by: ['promoId'],
        where: { status: { not: PromoUsageStatus.cancelled } },
        _count: true,
        orderBy: { _count: { promoId: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.count({
        where: { action: 'promo.invalid_attempt', createdAt: { gte: monthStart } },
      }),
    ]);

    const totalRedemptions = usages.length;
    const revenueGenerated = usages.reduce((s, u) => s + Number(u.amount), 0);
    const discountGiven = usages.reduce((s, u) => s + Number(u.discountApplied), 0);
    const bonusCoinsIssued = usages.reduce((s, u) => s + u.bonusCoinsGiven, 0);
    const cashbackIssued = usages.reduce((s, u) => s + u.cashbackCoinsGiven, 0);
    const avgRecharge = totalRedemptions > 0 ? revenueGenerated / totalRedemptions : 0;
    const extraVolume = discountGiven + bonusCoinsIssued + cashbackIssued;

    const promoIds = topCoupons.map((t) => t.promoId);
    const promoMap = new Map(
      (
        await this.prisma.promoCode.findMany({
          where: { id: { in: promoIds } },
          select: { id: true, code: true, title: true },
        })
      ).map((p) => [p.id, p]),
    );

    return {
      totalCoupons,
      activeCoupons,
      totalRedemptions,
      successRate:
        totalCoupons > 0 ? Math.round((totalRedemptions / (totalCoupons * 10)) * 100) : 0,
      revenueGenerated: Math.round(revenueGenerated * 100) / 100,
      extraRechargeVolume: Math.round(extraVolume * 100) / 100,
      conversionRate:
        totalCoupons > 0 ? Math.round((totalRedemptions / totalCoupons) * 100) : 0,
      couponAbuse: abuseCount,
      averageRecharge: Math.round(avgRecharge * 100) / 100,
      bonusCoinsIssued,
      cashbackIssued,
      campaignRoi:
        discountGiven > 0
          ? Math.round(((revenueGenerated - discountGiven) / discountGiven) * 100)
          : 0,
      dailyRedemptions: todayUsages,
      weeklyRedemptions: weekUsages,
      monthlyRedemptions: monthUsages,
      topCoupons: topCoupons.map((t) => ({
        promoId: t.promoId,
        code: promoMap.get(t.promoId)?.code ?? 'Unknown',
        title: promoMap.get(t.promoId)?.title ?? 'Unknown',
        redemptions: t._count,
      })),
    };
  }

  private buildWhere(query: AdminPromotionsQueryDto): Prisma.PromoCodeWhereInput {
    const where: Prisma.PromoCodeWhereInput = {};
    const now = new Date();

    if (query.campaignType) {
      where.campaignType = query.campaignType.toLowerCase() as PromoCampaignType;
    }

    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;
    if (query.status === 'expired') {
      where.expiresAt = { lt: now };
    }

    if (query.campaignId) where.campaignId = query.campaignId;

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private buildOrder(sort?: string): Prisma.PromoCodeOrderByWithRelationInput {
    switch (sort) {
      case 'usage':
        return { currentUsage: 'desc' };
      case 'expiry':
        return { expiresAt: 'asc' };
      case 'code':
        return { code: 'asc' };
      default:
        return { createdAt: 'desc' };
    }
  }
}