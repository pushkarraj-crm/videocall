import { apiClient } from './client';

export const riskApi = {
  dashboard: () =>
    apiClient<{
      highRiskAccounts: number;
      mediumRiskAccounts: number;
      criticalAccounts: number;
      recentEvents: Array<{
        id: string;
        userId: string;
        eventType: string;
        riskScore: number;
        riskLevel: string;
        reason: string;
      }>;
      topFraudTypes: Array<{ type: string; count: number }>;
      criticalAlerts: Array<{
        id: string;
        userId: string;
        displayName: string;
        type: string;
        riskScore: number;
      }>;
    }>('/admin/risk'),

  list: (params?: {
    page?: number;
    riskLevel?: string;
    search?: string;
    country?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.riskLevel) search.set('riskLevel', params.riskLevel);
    if (params?.search) search.set('search', params.search);
    if (params?.country) search.set('country', params.country);
    const qs = search.toString();
    return apiClient<{
      items: Array<{
        id: string;
        userId: string;
        displayName: string;
        email: string | null;
        phone: string | null;
        userStatus: string;
        aggregateScore: number;
        riskLevel: string;
        freezeWithdrawals: boolean;
        freezeReferralRewards: boolean;
        freezeCouponRedemption: boolean;
        requireReKyc: boolean;
        lastCountry: string | null;
        lastIp: string | null;
        lastEventAt: string | null;
      }>;
      total: number;
      page: number;
      limit: number;
    }>(`/admin/risk/profiles${qs ? `?${qs}` : ''}`);
  },

  detail: (userId: string) =>
    apiClient<{
      user: {
        id: string;
        displayName: string | null;
        email: string | null;
        phone: string | null;
        status: string;
        createdAt: string;
      };
      profile: {
        aggregateScore?: number;
        riskLevel?: string;
        freezeWithdrawals?: boolean;
        freezeReferralRewards?: boolean;
        freezeCouponRedemption?: boolean;
        requireReKyc?: boolean;
        lastCountry?: string | null;
        lastIp?: string | null;
      };
      events: Array<{
        id: string;
        eventType: string;
        riskScore: number;
        riskLevel: string;
        reason: string;
      }>;
      flags: Array<{
        id: string;
        type: string;
        status: string;
        riskScore: number;
        reason: string | null;
      }>;
      timeline: Array<{
        kind: string;
        at: string;
        title: string;
        score?: number;
        level?: string | null;
        reason?: string | null;
      }>;
      devices: Array<{
        fingerprintHash: string;
        platform: string | null;
        os: string | null;
        lastCountry: string | null;
      }>;
    }>(`/admin/risk/${userId}`),

  update: (
    userId: string,
    body: {
      freezeWithdrawals?: boolean;
      freezeReferralRewards?: boolean;
      freezeCouponRedemption?: boolean;
      requireReKyc?: boolean;
      markSafe?: boolean;
      suspendAccount?: boolean;
      unsuspendAccount?: boolean;
      adminNote?: string;
    },
  ) =>
    apiClient(`/admin/risk/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  events: (params?: { page?: number; userId?: string; riskLevel?: string }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.userId) search.set('userId', params.userId);
    if (params?.riskLevel) search.set('riskLevel', params.riskLevel);
    const qs = search.toString();
    return apiClient(`/admin/risk/events${qs ? `?${qs}` : ''}`);
  },

  analytics: () =>
    apiClient<{
      dailyFraudAttempts: number;
      weeklyFraudAttempts: number;
      monthlyFraudAttempts: number;
      referralAbuse: number;
      couponAbuse: number;
      rechargeAbuse: number;
      withdrawalAbuse: number;
      topRiskCountries: Array<{ country: string; count: number }>;
    }>('/admin/risk/analytics'),
};