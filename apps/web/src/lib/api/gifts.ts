import { apiClient } from './client';
import type { GiftCatalogItem, GiftSentEvent, SendGiftResponse } from '@/lib/gifts/types';

export const giftsApi = {
  catalog: (params?: { category?: string; featured?: boolean; trending?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.category) search.set('category', params.category);
    if (params?.featured) search.set('featured', 'true');
    if (params?.trending) search.set('trending', 'true');
    const qs = search.toString();
    return apiClient<{ items: GiftCatalogItem[]; categories: string[] }>(
      `/gifts/catalog${qs ? `?${qs}` : ''}`,
    );
  },

  send: (callId: string, giftId: string, quantity = 1, idempotencyKey?: string) =>
    apiClient<SendGiftResponse>(`/calls/${callId}/gifts`, {
      method: 'POST',
      body: JSON.stringify({ giftId, quantity, idempotencyKey }),
    }),

  callFeed: (callId: string, since?: string) => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiClient<{ gifts: GiftSentEvent[] }>(`/gifts/calls/${callId}/feed${qs}`);
  },

  history: (page = 1, limit = 20) =>
    apiClient<{
      items: Array<{
        id: string;
        giftId: string;
        quantity: number;
        coinCoins: number;
        status: string;
        createdAt: string;
        recipient: { id: string; displayName: string; avatarUrl: string | null };
        gift: { name: string; icon: string; animationKey: string };
      }>;
      total: number;
      page: number;
      limit: number;
    }>(`/gifts/history?page=${page}&limit=${limit}`),

  myStats: () =>
    apiClient<{
      totalGiftsSent: number;
      totalCoinsSpent: number;
      monthlyCoinsSpent: number;
      monthlyGiftCount: number;
      favoriteGift: { slug: string; name: string; icon: string; count: number } | null;
    }>('/gifts/stats/me'),

  hostStats: () =>
    apiClient<{
      todayGifts: number;
      todayCoins: number;
      todayEarnings: number;
      totalGifts: number;
      totalCoins: number;
      totalEarnings: number;
      mostReceivedGift: { slug: string; name: string; icon: string; count: number } | null;
      topSender: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
        totalCoins: number;
      } | null;
      recentGifts: Array<{
        id: string;
        giftName: string;
        icon: string;
        quantity: number;
        coins: number;
        senderName: string;
        createdAt: string;
      }>;
    }>('/gifts/stats/host'),

  leaderboard: (period: 'daily' | 'weekly' | 'monthly' | 'all_time' = 'weekly') =>
    apiClient<{
      period: string;
      topGifters: Array<{
        rank: number;
        user: { id: string; displayName: string; avatarUrl: string | null } | undefined;
        giftCount: number;
        totalCoins: number;
      }>;
      topHosts: Array<{
        rank: number;
        user: { id: string; displayName: string; avatarUrl: string | null } | undefined;
        giftCount: number;
        totalEarnings: number;
      }>;
    }>(`/gifts/leaderboard?period=${period}`),
};