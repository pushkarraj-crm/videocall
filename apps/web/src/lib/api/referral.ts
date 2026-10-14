import { apiClient } from './client';

export interface ReferralDashboard {
  referralCode: string | null;
  displayName: string;
  program: {
    enabled: boolean;
    inviterRewardCoins: number;
    invitedRewardCoins: number;
    completionRule: string;
  };
  summary: {
    totalInvites: number;
    pendingInvites: number;
    successfulInvites: number;
    completedInvites: number;
    cancelledInvites: number;
    referralEarningsCoins: number;
    referralsToday: number;
    referralsThisMonth: number;
    conversionRate: number;
  };
  invites: ReferralRecord[];
  receivedReferral: ReferralRecord | null;
}

export interface ReferralRecord {
  id: string;
  referralCode: string;
  displayStatus: string;
  referrerRewardCoins: number;
  referredRewardCoins: number;
  rewardGiven: boolean;
  createdAt: string;
  completedAt: string | null;
  rewardedAt: string | null;
  referredUser?: { displayName: string } | null;
  referrer?: { displayName: string } | null;
}

export interface HostReferralStats {
  referralEarnings: number;
  referralCount: number;
  referralsToday: number;
  referralsThisMonth: number;
  successfulInvites: number;
  pendingInvites: number;
  referralCode: string | null;
}

export const referralApi = {
  me: () => apiClient<ReferralDashboard>('/referral/me'),

  history: (page = 1, limit = 20) =>
    apiClient<{ items: ReferralRecord[]; total: number; page: number; limit: number }>(
      `/referral/history?page=${page}&limit=${limit}`,
    ),

  apply: (referralCode: string, deviceFingerprint?: string) =>
    apiClient('/referral/apply', {
      method: 'POST',
      body: JSON.stringify({ referralCode, deviceFingerprint }),
    }),

  hostStats: () => apiClient<HostReferralStats>('/host/referral/stats'),
};