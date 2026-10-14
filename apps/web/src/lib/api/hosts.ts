import { apiClient } from './client';
import type { HostDiscoverItem } from '@/types/api';

export interface EarningHistoryItem {
  date: string;
  callId: string;
  minutes: number;
  coins: number;
  grossUnits: string;
  platformFeeUnits: string;
  hostUnits: string;
  grossInr: number;
  platformFeeInr: number;
  hostInr: number;
  status: string;
  isFreeCall: boolean;
}

export interface EarningsSummary {
  totalEarnedUnits: string;
  totalEarnedCoins: number;
  totalEarnedInr: number;
  availableBalanceUnits: string;
  availableBalanceCoins: number;
  availableBalanceInr: number;
  pendingBalanceUnits: string;
  pendingBalanceCoins: number;
  pendingBalanceInr: number;
  totalCalls: number;
  totalMinutes: number;
  platformFeePercent: number;
  inrPerCoin: number;
  giftEarningsUnits: string;
  giftEarningsCoins: number;
  giftEarningsInr: number;
  callEarningsUnits: string;
  callEarningsCoins: number;
  callEarningsInr: number;
  withdrawableUnits: string;
  withdrawableCoins: number;
  withdrawableInr: number;
  pendingWithdrawalUnits: string;
  pendingWithdrawalCoins: number;
  pendingWithdrawalInr: number;
  completedWithdrawalUnits: string;
  completedWithdrawalCoins: number;
  completedWithdrawalInr: number;
  recentEarnings: Record<string, unknown>[];
  withdrawals: Record<string, unknown>[];
}

export const hostsApi = {
  discover: (page = 1, limit = 20) =>
    apiClient<{ hosts: HostDiscoverItem[]; total: number; page: number; limit: number }>(
      `/hosts/discover?page=${page}&limit=${limit}`,
    ),

  apply: () =>
    apiClient<{ userId: string; status: string; instant?: boolean }>('/hosts/apply', {
      method: 'POST',
    }),

  getApplication: () =>
    apiClient<{
      userId: string;
      status: string | null;
      rejectionReason?: string | null;
      reviewedAt?: string | null;
      createdAt?: string;
      isHost: boolean;
      canAccessDashboard: boolean;
    }>('/hosts/application'),

  heartbeat: () =>
    apiClient<{ userId: string; lastBeatAt: string; nextBeatInMs: number }>('/hosts/heartbeat', {
      method: 'POST',
    }),

  getStatus: () =>
    apiClient<{
      hostId: string;
      isOnline: boolean;
      isBusy: boolean;
      status: 'ONLINE' | 'OFFLINE' | 'BUSY';
      lastSeenAt: string | null;
      lastSeenLabel: string;
      canReceiveCalls: boolean;
      heartbeatFresh?: boolean;
      lastBeatAt?: string | null;
      nextHeartbeatInMs?: number | null;
    }>('/hosts/status'),

  setStatus: (status: 'ONLINE' | 'OFFLINE') =>
    apiClient('/hosts/status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  setAvailability: (isAvailable: boolean) =>
    apiClient('/hosts/availability', {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    }),

  dashboard: () => apiClient('/hosts/dashboard'),

  getEarnings: () => apiClient<EarningsSummary>('/hosts/earnings'),

  getEarningsHistory: (page = 1, limit = 20) =>
    apiClient<{ items: EarningHistoryItem[]; total: number; page: number; limit: number }>(
      `/hosts/earnings/history?page=${page}&limit=${limit}`,
    ),

  getWithdrawals: (page = 1, limit = 20) =>
    apiClient<{ items: Record<string, unknown>[]; total: number }>(
      `/hosts/withdrawals?page=${page}&limit=${limit}`,
    ),

  listBankAccounts: () =>
    apiClient<
      {
        id: string;
        accountHolderName: string;
        accountNumberMasked: string;
        ifscCode: string;
        isVerified: boolean;
      }[]
    >('/hosts/bank-accounts'),

  addBankAccount: (data: Record<string, unknown>) =>
    apiClient('/hosts/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),

  requestWithdrawalUpi: (data: {
    upiId: string;
    accountHolderName: string;
    amountUnits: number;
    idempotencyKey?: string;
  }) =>
    apiClient('/hosts/withdrawals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  requestWithdrawal: (bankAccountId: string, amountUnits: number) =>
    apiClient('/hosts/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ bankAccountId, amountUnits }),
    }),

  kycStatus: () =>
    apiClient<{
      id?: string;
      status: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
      submittedAt: string | null;
      verifiedAt: string | null;
      adminNote: string | null;
      aadhaarMasked: string | null;
      panMasked: string | null;
      canSubmit: boolean;
      canWithdraw: boolean;
    }>('/hosts/kyc/status'),

  kycHistory: () =>
    apiClient<
      Array<{
        id: string;
        status: string;
        submittedAt: string;
        adminNote: string | null;
      }>
    >('/hosts/kyc/history'),

  submitKyc: (data: {
    fullName: string;
    dob: string;
    upiId: string;
    aadhaarNumber: string;
    panNumber?: string;
    selfieImage: string;
    aadhaarFrontImage: string;
    aadhaarBackImage: string;
  }) =>
    apiClient('/hosts/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  kycInitiate: () => apiClient('/hosts/kyc/initiate', { method: 'POST', body: '{}' }),
};