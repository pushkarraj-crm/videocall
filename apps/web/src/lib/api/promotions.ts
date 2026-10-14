import { apiClient } from './client';

export interface PromoPreview {
  originalInr: number;
  finalInr: number;
  discountInr: number;
  bonusCoins: number;
  cashbackCoins: number;
  totalCoins: number;
  savingsInr: number;
}

export interface AvailableCoupon {
  id: string;
  code: string;
  title: string;
  campaignType: string;
  discountType: string;
  preview: PromoPreview;
  score: number;
  isBestValue: boolean;
  badges: string[];
  expiresAt: string | null;
}

export interface PromoHistoryItem {
  id: string;
  couponCode?: string;
  couponTitle?: string;
  rechargeAmount: number;
  discountApplied: number;
  bonusCoinsGiven: number;
  cashbackCoinsGiven: number;
  status: string;
  createdAt: string;
}

export const promotionsApi = {
  available: (packageId?: string, customCoins?: number) => {
    const params = new URLSearchParams();
    if (packageId) params.set('packageId', packageId);
    if (customCoins) params.set('customCoins', String(customCoins));
    const qs = params.toString();
    return apiClient<{
      recharge: { packageId: string | null; priceInr: number; baseCoins: number };
      coupons: AvailableCoupon[];
      recommended: AvailableCoupon | null;
      activePromo: { code: string; title: string } | null;
      activePreview: PromoPreview | null;
      banners: Array<{ id: string; name: string; banner: string | null; endDate: string }>;
    }>(`/promotions/available${qs ? `?${qs}` : ''}`);
  },

  apply: (code: string, packageId?: string, customCoins?: number) =>
    apiClient<{ applied: boolean; preview: PromoPreview & { code: string; expiresAt: string } }>(
      '/promotions/apply',
      {
        method: 'POST',
        body: JSON.stringify({ code, packageId, customCoins }),
      },
    ),

  remove: () =>
    apiClient<{ removed: boolean }>('/promotions/remove', { method: 'POST' }),

  checkout: (packageId?: string, customCoins?: number) =>
    apiClient<{
      paymentId: string;
      razorpayOrderId: string;
      totalInr: number;
      keyId: string;
      coinUnitsCredited: string;
      promo: { code: string; discountInr: number; finalInr: number };
    }>('/promotions/checkout', {
      method: 'POST',
      body: JSON.stringify({ packageId, customCoins }),
    }),

  history: (page = 1, limit = 20) =>
    apiClient<{ items: PromoHistoryItem[]; total: number; page: number; limit: number }>(
      `/promotions/history?page=${page}&limit=${limit}`,
    ),
};