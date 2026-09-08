import {
  CampaignStatus,
  PromoCampaignType,
  PromoCode,
  PromoDiscountType,
  PromoUsage,
  PromoUsageStatus,
  PromoVisibility,
} from '@prisma/client';
import { unitsToCoins } from '../constants/coins';

export function serializePromoCode(promo: PromoCode & { campaign?: { id: string; name: string; banner: string | null; status: CampaignStatus } | null }) {
  return {
    id: promo.id,
    code: promo.code,
    title: promo.title,
    description: promo.description,
    campaignType: promo.campaignType.toUpperCase(),
    discountType: promo.discountType.toUpperCase(),
    discountValue: Number(promo.discountValue),
    maxDiscount: promo.maxDiscount != null ? Number(promo.maxDiscount) : null,
    minimumRecharge: Number(promo.minimumRecharge),
    bonusCoins: promo.bonusCoins,
    cashbackCoins: promo.cashbackCoins,
    usageLimit: promo.usageLimit,
    usagePerUser: promo.usagePerUser,
    currentUsage: promo.currentUsage,
    visibility: promo.visibility.toUpperCase(),
    isActive: promo.isActive,
    startsAt: promo.startsAt?.toISOString() ?? null,
    expiresAt: promo.expiresAt?.toISOString() ?? null,
    campaignId: promo.campaignId,
    campaign: promo.campaign
      ? {
          id: promo.campaign.id,
          name: promo.campaign.name,
          banner: promo.campaign.banner,
          status: promo.campaign.status.toUpperCase(),
        }
      : null,
    createdAt: promo.createdAt.toISOString(),
    updatedAt: promo.updatedAt.toISOString(),
  };
}

export function serializePromoUsage(
  usage: PromoUsage & {
    promo?: { code: string; title: string; campaignType: PromoCampaignType };
  },
) {
  return {
    id: usage.id,
    promoId: usage.promoId,
    userId: usage.userId,
    paymentId: usage.paymentId,
    couponCode: usage.promo?.code,
    couponTitle: usage.promo?.title,
    campaignType: usage.promo?.campaignType?.toUpperCase(),
    rechargeAmount: Number(usage.amount),
    discountApplied: Number(usage.discountApplied),
    bonusCoinsGiven: usage.bonusCoinsGiven,
    cashbackCoinsGiven: usage.cashbackCoinsGiven,
    status: usage.status.toUpperCase(),
    createdAt: usage.createdAt.toISOString(),
  };
}

export function promoUsageDisplayStatus(status: PromoUsageStatus): string {
  const map: Record<PromoUsageStatus, string> = {
    pending: 'PENDING',
    completed: 'COMPLETED',
    cashback_pending: 'CASHBACK_PENDING',
    cancelled: 'CANCELLED',
  };
  return map[status];
}

export const PROMO_CAMPAIGN_TYPES = Object.values(PromoCampaignType);
export const PROMO_DISCOUNT_TYPES = Object.values(PromoDiscountType);
export const PROMO_VISIBILITY_TYPES = Object.values(PromoVisibility);