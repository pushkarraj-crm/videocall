import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CampaignStatus,
  PaymentStatus,
  Prisma,
  PromoCampaignType,
  PromoCode,
  PromoUsageStatus,
  PromoVisibility,
  Role,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { coinsToUnits } from '../../common/constants/coins';
import { BusinessException } from '../../common/exceptions/business.exception';
import { calculatePromoBenefits, scorePromoForRecharge } from '../../common/utils/promo-engine';
import { serializePromoCode, serializePromoUsage } from '../../common/utils/promo-display';
import { PrismaService } from '../../database/prisma.service';
import { RazorpayService } from '../../integrations/razorpay/razorpay.service';

const APPLICATION_TTL_MS = 30 * 60 * 1000;

type PromoWithCampaign = PromoCode & {
  campaign?: {
    id: string;
    name: string;
    banner: string | null;
    status: CampaignStatus;
    startDate: Date;
    endDate: Date;
    priority: number;
  } | null;
};

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
  ) {}

  async getAvailable(
    userId: string,
    packageId?: string,
    customCoins?: number,
  ) {
    const recharge = await this.resolveRecharge(packageId, customCoins);
    const promos = await this.findEligiblePromos(userId, recharge.priceInr);
    const scored = promos.map((promo) => {
      const benefits = this.benefitsForPromo(promo, recharge.priceInr, recharge.coinUnitsCredited);
      const score = scorePromoForRecharge({
        discountInr: benefits.discountInr,
        bonusCoins: promo.bonusCoins,
        cashbackCoins: promo.cashbackCoins,
        minimumRecharge: Number(promo.minimumRecharge),
        rechargeInr: recharge.priceInr,
      });
      return {
        ...serializePromoCode(promo),
        preview: {
          originalInr: benefits.originalInr,
          finalInr: benefits.finalInr,
          discountInr: benefits.discountInr,
          bonusCoins: promo.bonusCoins,
          cashbackCoins: promo.cashbackCoins,
          totalCoins: Number(benefits.totalCoinUnits) / 100,
          savingsInr: benefits.savingsInr,
        },
        score,
        isBestValue: false,
        badges: this.promoBadges(promo),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    if (scored[0]) scored[0].isBestValue = true;

    const activeCampaigns = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.active,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      orderBy: { priority: 'desc' },
      take: 5,
    });

    const application = await this.prisma.promoApplication.findUnique({
      where: { userId },
      include: { promo: { include: { campaign: true } } },
    });

    return {
      recharge: {
        packageId: recharge.packageId,
        customCoins: recharge.customCoins,
        priceInr: recharge.priceInr,
        baseCoins: Number(recharge.coinUnitsCredited) / 100,
      },
      coupons: scored,
      recommended: scored[0] ?? null,
      activePromo: application?.promo ? serializePromoCode(application.promo) : null,
      activePreview: application?.preview ?? null,
      banners: activeCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        banner: c.banner,
        endDate: c.endDate.toISOString(),
        priority: c.priority,
      })),
    };
  }

  async applyPromo(
    userId: string,
    code: string,
    packageId?: string,
    customCoins?: number,
  ) {
    const recharge = await this.resolveRecharge(packageId, customCoins);
    const promo = await this.loadPromoByCode(code);
    await this.validatePromoForUser(promo, userId, recharge.priceInr);

    const benefits = this.benefitsForPromo(promo, recharge.priceInr, recharge.coinUnitsCredited);
    const preview = {
      code: promo.code,
      promoId: promo.id,
      originalInr: benefits.originalInr,
      finalInr: benefits.finalInr,
      discountInr: benefits.discountInr,
      bonusCoins: promo.bonusCoins,
      cashbackCoins: promo.cashbackCoins,
      totalCoins: Number(benefits.totalCoinUnits) / 100,
      savingsInr: benefits.savingsInr,
      packageId: recharge.packageId,
      customCoins: recharge.customCoins,
      expiresAt: new Date(Date.now() + APPLICATION_TTL_MS).toISOString(),
    };

    const expiresAt = new Date(Date.now() + APPLICATION_TTL_MS);
    await this.prisma.promoApplication.upsert({
      where: { userId },
      create: {
        userId,
        promoId: promo.id,
        packageId: recharge.packageId,
        customCoins: recharge.customCoins,
        preview,
        expiresAt,
      },
      update: {
        promoId: promo.id,
        packageId: recharge.packageId,
        customCoins: recharge.customCoins,
        preview,
        expiresAt,
      },
    });

    return {
      applied: true,
      promo: serializePromoCode(promo),
      preview,
    };
  }

  async removePromo(userId: string) {
    await this.prisma.promoApplication.deleteMany({ where: { userId } });
    return { removed: true };
  }

  async checkout(userId: string, packageId?: string, customCoins?: number) {
    const recharge = await this.resolveRecharge(packageId, customCoins);
    const application = await this.prisma.promoApplication.findUnique({
      where: { userId },
      include: { promo: { include: { campaign: true } } },
    });

    if (!application || application.expiresAt < new Date()) {
      throw new BusinessException('No active coupon applied', 400, 'NO_ACTIVE_PROMO');
    }

    if (
      application.packageId !== recharge.packageId ||
      application.customCoins !== recharge.customCoins
    ) {
      throw new BusinessException(
        'Recharge amount changed — re-apply coupon',
        400,
        'PROMO_CONTEXT_MISMATCH',
      );
    }

    const promo = application.promo;
    await this.validatePromoForUser(promo, userId, recharge.priceInr);
    const benefits = this.benefitsForPromo(promo, recharge.priceInr, recharge.coinUnitsCredited);

    const gstInr = 0;
    const totalInr = benefits.finalInr;
    const idempotencyKey = `promo:order:${userId}:${promo.id}:${Date.now()}`;

    const order = await this.razorpay.createOrder({
      amountInr: totalInr,
      receipt: `rcpt_${uuidv4().replace(/-/g, '').slice(0, 20)}`,
      notes: {
        userId,
        packageId: recharge.packageId ?? 'custom',
        customCoins: recharge.customCoins?.toString() ?? '',
        promoCode: promo.code,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        packageId: recharge.packageId,
        razorpayOrderId: order.id,
        amountInr: recharge.priceInr,
        gstInr,
        totalInr,
        coinUnitsCredited: benefits.totalCoinUnits,
        status: PaymentStatus.created,
        idempotencyKey,
        metadata: {
          promoId: promo.id,
          promoCode: promo.code,
          discountInr: benefits.discountInr,
          bonusCoins: promo.bonusCoins,
          cashbackCoins: promo.cashbackCoins,
          originalInr: recharge.priceInr,
        } satisfies Prisma.InputJsonObject,
      },
    });

    await this.prisma.promoUsage.create({
      data: {
        promoId: promo.id,
        userId,
        paymentId: payment.id,
        amount: recharge.priceInr,
        discountApplied: benefits.discountInr,
        bonusCoinsGiven: promo.bonusCoins,
        cashbackCoinsGiven: promo.cashbackCoins,
        status: PromoUsageStatus.pending,
      },
    });

    await this.prisma.promoApplication.deleteMany({ where: { userId } });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      amountInr: recharge.priceInr,
      totalInr,
      currency: 'INR',
      keyId: this.config.get('RAZORPAY_KEY_ID'),
      coinUnitsCredited: benefits.totalCoinUnits.toString(),
      promo: {
        code: promo.code,
        discountInr: benefits.discountInr,
        bonusCoins: promo.bonusCoins,
        cashbackCoins: promo.cashbackCoins,
        finalInr: benefits.finalInr,
      },
    };
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.promoUsage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { promo: { select: { code: true, title: true, campaignType: true } } },
      }),
      this.prisma.promoUsage.count({ where: { userId } }),
    ]);

    return {
      items: rows.map((r) => serializePromoUsage(r)),
      total,
      page,
      limit,
    };
  }

  async processFulfilledPromoUsages() {
    const pending = await this.prisma.promoUsage.findMany({
      where: { status: PromoUsageStatus.pending },
      take: 100,
      include: { payment: { select: { id: true, status: true } } },
    });

    let completed = 0;
    for (const usage of pending) {
      if (usage.payment.status !== PaymentStatus.paid) continue;

      await this.prisma.$transaction([
        this.prisma.promoUsage.update({
          where: { id: usage.id },
          data: {
            status:
              usage.cashbackCoinsGiven > 0
                ? PromoUsageStatus.cashback_pending
                : PromoUsageStatus.completed,
          },
        }),
        this.prisma.promoCode.update({
          where: { id: usage.promoId },
          data: { currentUsage: { increment: 1 } },
        }),
      ]);

      if (usage.cashbackCoinsGiven > 0) {
        await this.prisma.promoUsage.update({
          where: { id: usage.id },
          data: { status: PromoUsageStatus.completed },
        });
      }

      completed++;
    }

    return { completed };
  }

  async logInvalidAttempt(userId: string, code: string, reason: string) {
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'promo.invalid_attempt',
        entityType: 'promo_code',
        entityId: null,
        newValue: { code, reason },
      },
    });
  }

  private async resolveRecharge(packageId?: string, customCoins?: number) {
    if (!packageId && !customCoins) {
      throw new BusinessException('Package or amount required', 400, 'INVALID_RECHARGE');
    }
    if (packageId && customCoins) {
      throw new BusinessException('Specify package or custom amount', 400, 'INVALID_RECHARGE');
    }

    if (packageId) {
      const pkg = await this.prisma.coinPackage.findFirst({
        where: { id: packageId, isActive: true, deletedAt: null },
      });
      if (!pkg) {
        throw new BusinessException('Package not found', 404, 'PACKAGE_NOT_FOUND');
      }
      return {
        packageId,
        customCoins: null as number | null,
        priceInr: Number(pkg.priceInr),
        coinUnitsCredited: pkg.coinUnits + pkg.bonusUnits,
      };
    }

    return {
      packageId: null as string | null,
      customCoins: customCoins!,
      priceInr: customCoins!,
      coinUnitsCredited: coinsToUnits(customCoins!),
    };
  }

  private async loadPromoByCode(code: string): Promise<PromoWithCampaign> {
    const promo = await this.prisma.promoCode.findFirst({
      where: { code: code.trim().toUpperCase() },
      include: { campaign: true },
    });
    if (!promo) {
      throw new BusinessException('Invalid coupon code', 400, 'INVALID_PROMO');
    }
    return promo;
  }

  private async findEligiblePromos(userId: string, rechargeInr: number) {
    const now = new Date();
    const promos = await this.prisma.promoCode.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      include: { campaign: true },
      take: 50,
    });

    const eligible: PromoWithCampaign[] = [];
    for (const promo of promos) {
      try {
        await this.validatePromoForUser(promo, userId, rechargeInr, false);
        if (promo.visibility === PromoVisibility.private) continue;
        eligible.push(promo);
      } catch {
        // skip ineligible
      }
    }
    return eligible;
  }

  private async validatePromoForUser(
    promo: PromoWithCampaign,
    userId: string,
    rechargeInr: number,
    logFailure = true,
  ) {
    const now = new Date();

    if (!promo.isActive) {
      throw new BusinessException('Coupon is inactive', 400, 'PROMO_INACTIVE');
    }
    if (promo.startsAt && promo.startsAt > now) {
      throw new BusinessException('Coupon not started yet', 400, 'PROMO_NOT_STARTED');
    }
    if (promo.expiresAt && promo.expiresAt < now) {
      throw new BusinessException('Coupon expired', 400, 'PROMO_EXPIRED');
    }
    if (Number(promo.minimumRecharge) > rechargeInr) {
      throw new BusinessException('Minimum recharge not met', 400, 'MIN_RECHARGE_NOT_MET');
    }
    if (promo.usageLimit != null && promo.currentUsage >= promo.usageLimit) {
      throw new BusinessException('Coupon usage limit reached', 400, 'USAGE_LIMIT_REACHED');
    }

    const userUsageCount = await this.prisma.promoUsage.count({
      where: {
        promoId: promo.id,
        userId,
        status: { not: PromoUsageStatus.cancelled },
      },
    });
    if (userUsageCount >= promo.usagePerUser) {
      throw new BusinessException('Per-user limit reached', 400, 'USER_LIMIT_REACHED');
    }

    if (promo.campaign) {
      if (promo.campaign.status !== CampaignStatus.active) {
        throw new BusinessException('Campaign not active', 400, 'CAMPAIGN_INACTIVE');
      }
      if (promo.campaign.startDate > now || promo.campaign.endDate < now) {
        throw new BusinessException('Campaign not in date range', 400, 'CAMPAIGN_EXPIRED');
      }
    }

    await this.validateCampaignType(promo, userId);

    if (promo.visibility === PromoVisibility.vip_only) {
      const isVip = await this.isVipUser(userId);
      if (!isVip) {
        throw new BusinessException('VIP coupon only', 403, 'VIP_ONLY');
      }
    }

    if (promo.visibility === PromoVisibility.referral_only) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { referredById: true },
      });
      if (!user?.referredById) {
        throw new BusinessException('Referral coupon only', 403, 'REFERRAL_ONLY');
      }
    }

    if (logFailure) {
      // no-op placeholder for future fraud scoring
    }
  }

  private async validateCampaignType(promo: PromoWithCampaign, userId: string) {
    const paidCount = await this.prisma.payment.count({
      where: { userId, status: PaymentStatus.paid },
    });

    if (
      promo.campaignType === PromoCampaignType.welcome ||
      promo.campaignType === PromoCampaignType.first_recharge
    ) {
      if (paidCount > 0) {
        throw new BusinessException('First recharge only', 400, 'FIRST_RECHARGE_ONLY');
      }
    }

    if (promo.campaignType === PromoCampaignType.weekend) {
      const day = new Date().getDay();
      if (day !== 0 && day !== 6) {
        throw new BusinessException('Weekend coupon only', 400, 'WEEKEND_ONLY');
      }
    }
  }

  private async isVipUser(userId: string) {
    const [roles, wallet] = await Promise.all([
      this.prisma.userRole.findFirst({
        where: { userId, role: Role.host, revokedAt: null },
      }),
      this.prisma.wallet.findUnique({
        where: { userId },
        select: { lifetimeCreditedUnits: true },
      }),
    ]);
    if (roles) return true;
    const lifetimeCoins = Number(wallet?.lifetimeCreditedUnits ?? 0n) / 100;
    return lifetimeCoins >= 5000;
  }

  private benefitsForPromo(
    promo: PromoCode,
    rechargeInr: number,
    baseCoinUnits: bigint,
  ) {
    return calculatePromoBenefits({
      rechargeInr,
      baseCoinUnits,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue),
      maxDiscount: promo.maxDiscount != null ? Number(promo.maxDiscount) : null,
      bonusCoins: promo.bonusCoins,
      cashbackCoins: promo.cashbackCoins,
    });
  }

  private promoBadges(promo: PromoCode) {
    const badges: string[] = [];
    if (promo.campaignType === PromoCampaignType.festival) badges.push('Festival');
    if (promo.campaignType === PromoCampaignType.flash_sale) badges.push('Flash Sale');
    if (promo.bonusCoins > 0) badges.push('Bonus Coins');
    if (promo.cashbackCoins > 0) badges.push('Cashback');
    if (promo.expiresAt) badges.push('Limited Time');
    return badges;
  }
}