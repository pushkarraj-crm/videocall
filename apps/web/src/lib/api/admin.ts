import { apiClient, ApiClientError } from './client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

async function adminUploadFile(path: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new ApiClientError(
      json.error?.message ?? 'Upload failed',
      json.error?.statusCode ?? res.status,
      { code: json.error?.code },
    );
  }
  return json.data;
}

export interface AdminWithdrawal {
  id: string;
  hostId: string;
  host: { id: string; displayName: string; phone: string | null };
  bankAccount: {
    accountHolderName: string;
    accountNumberMasked: string;
    ifscCode: string;
    bankName: string | null;
  } | null;
  upiId: string | null;
  accountHolderName: string | null;
  amountUnits: string;
  amountCoins: number;
  amountInr: string;
  netInr: string;
  status: string;
  displayStatus: string;
  rejectionReason: string | null;
  adminNote: string | null;
  approvedAt: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface PlatformRevenueDetail {
  totalRevenueInr: number;
  todayRevenueInr: number;
  monthlyRevenueInr: number;
  pendingRevenueInr: number;
  availableRevenueInr: number;
  platformFeesInr: number;
  rechargeRevenueInr: number;
  withdrawnInr: number;
  settlements: Array<{
    id: string;
    action: string;
    amountInr: number;
    totalWithdrawn: number;
    createdAt: string;
  }>;
}

export interface AdminReview {
  id: string;
  callId: string;
  hostId: string;
  userId: string;
  rating: number;
  reviewText: string | null;
  isHidden: boolean;
  isReported: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; displayName: string; avatarUrl: string | null };
  host?: { id: string; displayName: string; avatarUrl: string | null };
}

export interface ReviewAnalytics {
  averagePlatformRating: number | null;
  totalReviews: number;
  reviewsToday: number;
  reviewsThisMonth: number;
  topRatedHosts: Array<{
    hostId: string;
    displayName: string;
    avatarUrl: string | null;
    averageRating: number | null;
    totalReviews: number;
  }>;
  lowestRatedHosts: Array<{
    hostId: string;
    displayName: string;
    avatarUrl: string | null;
    averageRating: number | null;
    totalReviews: number;
  }>;
}

export interface AdminReferralRecord {
  id: string;
  referrerId: string;
  referredUserId: string;
  referralCode: string;
  displayStatus: string;
  rewardGiven: boolean;
  referrerRewardCoins: number;
  referredRewardCoins: number;
  createdAt: string;
  completedAt: string | null;
  rewardedAt: string | null;
  referrer?: { id: string; displayName: string; avatarUrl: string | null };
  referredUser?: { id: string; displayName: string; avatarUrl: string | null };
}

export interface ReferralAnalytics {
  totalReferrals: number;
  pendingReferrals: number;
  successfulReferrals: number;
  completedReferrals: number;
  cancelledReferrals: number;
  rewardAmountCoins: number;
  conversionRate: number;
  referralsToday: number;
  referralsThisMonth: number;
  dailyGrowth: number;
  monthlyGrowthPercent: number;
  topReferrers: Array<{
    userId: string;
    displayName: string;
    successfulReferrals: number;
  }>;
  topEarners: Array<{
    userId: string;
    displayName: string;
    earningsCoins: number;
  }>;
}

export interface AdminFollowRecord {
  id: string;
  userId: string;
  hostId: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  host?: { id: string; displayName: string; avatarUrl: string | null };
  completedCalls?: number;
}

export interface FollowerAnalytics {
  totalFollows: number;
  totalUnfollows: number;
  followersToday: number;
  followersThisMonth: number;
  averageFollowers: number;
  mostFollowedHost: {
    hostId: string;
    displayName: string;
    avatarUrl: string | null;
    followerCount: number;
    averageRating: number | null;
  } | null;
  topHosts: Array<{
    hostId: string;
    displayName: string;
    avatarUrl: string | null;
    followerCount: number;
    averageRating: number | null;
  }>;
  fastestGrowingHosts: Array<{
    hostId: string;
    displayName: string;
    avatarUrl: string | null;
    newFollowers: number;
  }>;
  timeline: Array<{ date: string; follows: number; unfollows: number }>;
}

export interface AdminPromoRecord {
  id: string;
  code: string;
  title: string;
  campaignType: string;
  discountType: string;
  discountValue: number;
  bonusCoins: number;
  cashbackCoins: number;
  usageLimit: number | null;
  currentUsage: number;
  isActive: boolean;
  expiresAt: string | null;
}

export interface PromoAnalytics {
  totalCoupons: number;
  activeCoupons: number;
  totalRedemptions: number;
  conversionRate: number;
  revenueGenerated: number;
  bonusCoinsIssued: number;
  cashbackIssued: number;
  couponAbuse: number;
  topCoupons: Array<{ promoId: string; code: string; title: string; redemptions: number }>;
}

export interface AdminReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  callId: string | null;
  reason: string;
  reasonLabel: string;
  description: string | null;
  status: string;
  displayStatus: string;
  severity: string;
  adminNote: string | null;
  resolution: string | null;
  resolutionAction: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  riskLevel: string;
  reporter?: { id: string; displayName: string; avatarUrl: string | null };
  reportedUser?: { id: string; displayName: string; avatarUrl: string | null };
}

export interface AdminKycSubmission {
  id: string;
  hostId: string;
  host: { id: string; displayName: string; phone: string | null; email: string | null };
  fullName: string | null;
  dob: string | null;
  aadhaarMasked: string | null;
  panMasked: string | null;
  status: string;
  displayStatus: string;
  adminNote: string | null;
  hasSelfie: boolean;
  hasAadhaarFront: boolean;
  hasAadhaarBack: boolean;
  submittedAt: string;
  verifiedAt: string | null;
}

export interface AdminUsersOverview {
  totalUsers: number;
  totalHosts: number;
  verifiedHosts: number;
  pendingKyc: number;
  onlineHosts: number;
  busyHosts: number;
  offlineHosts: number;
  suspendedUsers: number;
  suspendedHosts: number;
  newUsersToday: number;
}

export interface AdminUserListItem {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  status: string;
  onlineStatus: 'ONLINE' | 'OFFLINE' | 'BUSY' | null;
  kycStatus: string | null;
  walletBalanceCoins: number;
  totalRechargeInr: number;
  totalCalls: number;
  adminCallsDisabled: boolean;
  adminWithdrawalsDisabled: boolean;
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  roles: string[];
  status: string;
  adminNote: string | null;
  freeCallsUsed: number;
  deviceFingerprint: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  wallet: {
    balanceCoins: number;
    balanceUnits: string;
    lifetimeCreditedCoins: number;
  } | null;
  host: {
    isOnline: boolean;
    isBusy: boolean;
    status: string;
    adminCallsDisabled: boolean;
    adminWithdrawalsDisabled: boolean;
    totalCalls: number;
    totalEarningsCoins: number;
    withdrawableCoins: number;
    approvedAt: string | null;
  } | null;
  hostApplication: { id: string; status: string; reviewedAt: string | null } | null;
  kyc: {
    id?: string;
    status: string;
    adminNote?: string | null;
    submittedAt?: string;
    verifiedAt?: string | null;
  };
  device: { platform: string; lastUsedAt: string | null } | null;
  stats: {
    totalRechargeInr: number;
    rechargeCount: number;
    totalCalls: number;
    totalMinutes: number;
    totalWithdrawnInr: number;
    withdrawalCount: number;
  };
}

export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface AnalyticsDashboard {
  period: { key: AnalyticsPeriod; from: string; to: string };
  revenue: {
    todayInr: number;
    weekInr: number;
    monthInr: number;
    totalInr: number;
    totalWithdrawalsInr: number;
    platformProfitInr: number;
    totalRechargesInr: number;
    periodRechargeInr: number;
    periodPlatformFeesInr: number;
    periodTotalInr: number;
  };
  users: {
    totalUsers: number;
    activeUsersToday: number;
    newUsersToday: number;
    totalHosts: number;
    verifiedHosts: number;
    onlineHosts: number;
    busyHosts: number;
  };
  calls: {
    today: number;
    week: number;
    month: number;
    total: number;
    totalMinutes: number;
    periodCount: number;
    avgDurationSeconds: number;
    revenuePerCallInr: number;
  };
  recharges: {
    count: number;
    amountInr: number;
    avgInr: number;
    topPackage: { id: string; name: string; count: number; amountInr: number } | null;
  };
  withdrawals: {
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
    totalWithdrawnInr: number;
  };
  trend: Array<{
    date: string;
    revenueInr: number;
    rechargeInr: number;
    platformFeesInr: number;
    calls: number;
    recharges: number;
  }>;
  topHosts: Array<{
    hostId: string;
    name: string;
    calls: number;
    minutes: number;
    revenueInr: number;
    withdrawnInr: number;
  }>;
  topUsers: Array<{
    userId: string;
    name: string;
    rechargeInr: number;
    calls: number;
    minutes: number;
  }>;
}

export interface OperationsOverview {
  period: { key: AnalyticsPeriod; from: string; to: string };
  revenue: { totalInr: number; todayInr: number; monthlyInr: number; periodInr: number };
  live: {
    activeCalls: number;
    activeAiHosts: number;
    activeRealHosts: number;
    onlineUsers: number;
    onlineHosts: number;
    busyHosts: number;
  };
  hosts: {
    online: number;
    offline: number;
    busy: number;
    ai: number;
    real: number;
    managed: number;
    total: number;
  };
  charts: {
    revenue: Array<{ date: string; value: number; rechargeInr: number; platformFeesInr: number }>;
    dailyCalls: Array<{ date: string; value: number }>;
    recharges: Array<{ date: string; value: number; amountInr: number }>;
    coinUsage: Array<{ date: string; value: number }>;
  };
  topAiHosts: Array<{ hostId: string; name: string; calls: number; revenueCoins: number; rating: number | null }>;
  topRealHosts: Array<{ hostId: string; name: string; calls: number; revenueCoins: number; rating: number | null }>;
  fraud: {
    multipleAccounts: number;
    rechargeAbuse: number;
    callSpam: number;
    repeatedFailures24h: number;
    suspiciousIp7d: number;
    openFlags: number;
    recentAlerts: Array<{
      id: string;
      userId: string;
      userName: string;
      type: string;
      riskScore: number;
      reason: string | null;
      createdAt: string;
    }>;
  };
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    type: string;
    message: string;
    createdAt: string;
  }>;
  payments: { pending: number; periodRecharges: number; periodRechargeInr: number };
  withdrawals: { pending: number; approved: number; paid: number; rejected: number };
  updatedAt: string;
}

export const adminApi = {
  analytics: () => apiClient('/admin/analytics'),
  getOperationsOverview: (params?: {
    period?: AnalyticsPeriod;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.period) search.set('period', params.period);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiClient<OperationsOverview>(`/admin/operations/overview${qs ? `?${qs}` : ''}`);
  },
  getOperationsLiveCalls: (limit = 20) =>
    apiClient(`/admin/operations/live-calls?limit=${limit}`),
  getOperationsHosts: (page = 1, limit = 20) =>
    apiClient(`/admin/operations/hosts?page=${page}&limit=${limit}`),
  getOperationsPayments: (params?: { status?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiClient(`/admin/operations/payments${qs ? `?${qs}` : ''}`);
  },
  getOperationsSupport: (params?: { status?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiClient(`/admin/operations/support${qs ? `?${qs}` : ''}`);
  },
  replyOperationsSupport: (id: string, notes: string, action: 'acknowledge' | 'resolve') =>
    apiClient(`/admin/operations/support/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes, action }),
    }),
  getOperationsLogs: (params?: { type?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.type) search.set('type', params.type);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiClient(`/admin/operations/logs${qs ? `?${qs}` : ''}`);
  },
  getOperationsSettings: () => apiClient('/admin/operations/settings'),
  exportOperationsReport: async (params: {
    report: string;
    period?: AnalyticsPeriod;
    format?: 'csv' | 'excel';
  }) => {
    const search = new URLSearchParams({ report: params.report });
    if (params.period) search.set('period', params.period);
    if (params.format) search.set('format', params.format);
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
    const res = await fetch(`${API_BASE}/admin/operations/reports/export?${search}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    return res.text();
  },
  getAnalyticsDashboard: (params?: {
    period?: AnalyticsPeriod;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.period) search.set('period', params.period);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiClient<AnalyticsDashboard>(
      `/admin/analytics/dashboard${qs ? `?${qs}` : ''}`,
    );
  },
  exportAnalyticsCsv: async (params: {
    type: 'revenue' | 'hosts' | 'withdrawals';
    period?: AnalyticsPeriod;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams({ type: params.type });
    if (params.period) search.set('period', params.period);
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
    const res = await fetch(`${API_BASE}/admin/analytics/export?${search}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    return res.text();
  },
  getRevenue: () => apiClient<PlatformRevenueDetail>('/admin/revenue'),
  getUsers: (params?: {
    q?: string;
    role?: string;
    onlineStatus?: string;
    kycStatus?: string;
    accountStatus?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.role) search.set('role', params.role);
    if (params?.onlineStatus) search.set('onlineStatus', params.onlineStatus);
    if (params?.kycStatus) search.set('kycStatus', params.kycStatus);
    if (params?.accountStatus) search.set('accountStatus', params.accountStatus);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiClient<{
      overview: AdminUsersOverview;
      items: AdminUserListItem[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/users${qs ? `?${qs}` : ''}`);
  },
  getUser: (id: string) => apiClient<AdminUserDetail>(`/admin/users/${id}`),
  getUserHistory: (
    id: string,
    type: 'recharges' | 'calls' | 'withdrawals' | 'admin_logs',
    page = 1,
  ) => apiClient(`/admin/users/${id}/history?type=${type}&page=${page}`),
  suspendUser: (id: string, note?: string) =>
    apiClient(`/admin/users/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
  unsuspendUser: (id: string) =>
    apiClient(`/admin/users/${id}/unsuspend`, { method: 'PATCH' }),
  blockUser: (id: string, note?: string) =>
    apiClient(`/admin/users/${id}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
  unblockUser: (id: string) =>
    apiClient(`/admin/users/${id}/unblock`, { method: 'PATCH' }),
  deleteUser: (id: string) =>
    apiClient(`/admin/users/${id}`, { method: 'DELETE' }),
  forceOffline: (id: string) =>
    apiClient(`/admin/users/${id}/force-offline`, { method: 'PATCH' }),
  forceLogout: (id: string) =>
    apiClient(`/admin/users/${id}/force-logout`, { method: 'POST' }),
  updateUserNote: (id: string, note: string) =>
    apiClient(`/admin/users/${id}/note`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
  updateHostControls: (
    id: string,
    controls: { callsDisabled?: boolean; withdrawalsDisabled?: boolean },
  ) =>
    apiClient(`/admin/users/${id}/host-controls`, {
      method: 'PATCH',
      body: JSON.stringify(controls),
    }),
  resetFreeCalls: (id: string) =>
    apiClient(`/admin/users/${id}/reset-free-calls`, { method: 'POST' }),
  approveHost: (id: string) =>
    apiClient(`/admin/users/${id}/approve-host`, { method: 'POST' }),
  rejectHost: (id: string, note?: string) =>
    apiClient(`/admin/users/${id}/reject-host`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  hostApplications: (status?: string) =>
    apiClient(`/admin/hosts/applications${status ? `?status=${status}` : ''}`),
  reviewHostApplication: (id: string, data: Record<string, unknown>) =>
    apiClient(`/admin/hosts/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  reports: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    reason?: string;
    status?: string;
    sort?: 'newest' | 'oldest';
    reporterId?: string;
    reportedUserId?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.search) search.set('search', params.search);
    if (params?.reason) search.set('reason', params.reason);
    if (params?.status) search.set('status', params.status);
    if (params?.sort) search.set('sort', params.sort);
    if (params?.reporterId) search.set('reporterId', params.reporterId);
    if (params?.reportedUserId) search.set('reportedUserId', params.reportedUserId);
    const qs = search.toString();
    return apiClient<{ items: AdminReport[]; total: number; page: number; limit: number }>(
      `/admin/reports${qs ? `?${qs}` : ''}`,
    );
  },
  getReport: (id: string) =>
    apiClient<{
      report: AdminReport;
      previousReports: AdminReport[];
      reportedUserReportCount: number;
    }>(`/admin/reports/${id}`),
  updateReport: (
    id: string,
    data: {
      action: string;
      resolution?: string;
      adminNote?: string;
      enableCommunityWarning?: boolean;
    },
  ) =>
    apiClient(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  resolveReport: (id: string, resolution: string, action: string) =>
    apiClient(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution, action }),
    }),
  auditLogs: () => apiClient('/admin/audit-logs'),
  config: () => apiClient('/admin/config'),
  getWithdrawals: (status?: string, page = 1) =>
    apiClient<{ items: AdminWithdrawal[]; total: number }>(
      `/admin/withdrawals${status ? `?status=${status}` : ''}${status ? '&' : '?'}page=${page}`,
    ),
  approveWithdrawal: (id: string, note?: string) =>
    apiClient(`/admin/withdrawals/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
  rejectWithdrawal: (id: string, reason?: string) =>
    apiClient(`/admin/withdrawals/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  markWithdrawalPaid: (id: string, utr?: string, note?: string) =>
    apiClient(`/admin/withdrawals/${id}/paid`, {
      method: 'PATCH',
      body: JSON.stringify({ utr, note }),
    }),
  withdrawPlatformRevenue: (amountInr: number) =>
    apiClient('/admin/revenue/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amountInr }),
    }),
  markRevenueSettled: (amountInr: number, note?: string) =>
    apiClient('/admin/revenue/settle', {
      method: 'POST',
      body: JSON.stringify({ amountInr, note }),
    }),
  getKycSubmissions: (status?: string) =>
    apiClient<AdminKycSubmission[]>(`/admin/kyc${status ? `?status=${status}` : ''}`),
  approveKyc: (id: string) => apiClient(`/admin/kyc/${id}/approve`, { method: 'PATCH' }),
  rejectKyc: (id: string, note?: string) =>
    apiClient(`/admin/kyc/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
  kycDocumentUrl: (id: string, type: 'selfie' | 'aadhaar_front' | 'aadhaar_back') =>
    `/v1/admin/kyc/${id}/document/${type}`,

  reviews: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    hostId?: string;
    userId?: string;
    rating?: number;
    filter?: 'reported' | 'hidden' | 'visible';
    sort?: 'newest' | 'oldest';
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.search) search.set('search', params.search);
    if (params?.hostId) search.set('hostId', params.hostId);
    if (params?.userId) search.set('userId', params.userId);
    if (params?.rating) search.set('rating', String(params.rating));
    if (params?.filter) search.set('filter', params.filter);
    if (params?.sort) search.set('sort', params.sort);
    const qs = search.toString();
    return apiClient<{
      items: AdminReview[];
      total: number;
      page: number;
      limit: number;
      analytics: ReviewAnalytics;
    }>(`/admin/reviews${qs ? `?${qs}` : ''}`);
  },
  getReview: (id: string) =>
    apiClient<{
      review: AdminReview;
      call: {
        id: string;
        status: string;
        durationSeconds: number;
        startedAt: string | null;
        endedAt: string | null;
        answeredAt: string | null;
      };
    }>(`/admin/reviews/${id}`),
  updateReview: (id: string, action: 'hide' | 'unhide' | 'report' | 'unreport') =>
    apiClient(`/admin/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),
  deleteReview: (id: string) =>
    apiClient(`/admin/reviews/${id}`, { method: 'DELETE' }),

  followers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    hostId?: string;
    userId?: string;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.search) search.set('search', params.search);
    if (params?.hostId) search.set('hostId', params.hostId);
    if (params?.userId) search.set('userId', params.userId);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiClient<{
      items: AdminFollowRecord[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/followers${qs ? `?${qs}` : ''}`);
  },
  followerStats: () => apiClient<FollowerAnalytics>('/admin/followers/stats'),
  removeFakeFollow: (id: string) =>
    apiClient(`/admin/followers/${id}`, { method: 'DELETE' }),

  referrals: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.search) search.set('search', params.search);
    if (params?.status) search.set('status', params.status);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiClient<{
      items: AdminReferralRecord[];
      total: number;
      page: number;
      limit: number;
      analytics: ReferralAnalytics;
    }>(`/admin/referrals${qs ? `?${qs}` : ''}`);
  },
  rewardReferral: (referralId: string) =>
    apiClient('/admin/referrals/reward', {
      method: 'POST',
      body: JSON.stringify({ referralId }),
    }),
  cancelReferral: (referralId: string, reason?: string) =>
    apiClient('/admin/referrals/cancel', {
      method: 'POST',
      body: JSON.stringify({ referralId, reason }),
    }),
  exportReferralsCsv: async (params?: {
    search?: string;
    status?: string;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.search) search.set('search', params.search);
    if (params?.status) search.set('status', params.status);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
    const res = await fetch(`${API_BASE}/admin/referrals/export${qs ? `?${qs}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    return res.text();
  },

  promotions: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    campaignType?: string;
    sort?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.search) search.set('search', params.search);
    if (params?.status) search.set('status', params.status);
    if (params?.campaignType) search.set('campaignType', params.campaignType);
    if (params?.sort) search.set('sort', params.sort);
    const qs = search.toString();
    return apiClient<{
      items: AdminPromoRecord[];
      total: number;
      page: number;
      limit: number;
      analytics: PromoAnalytics;
    }>(`/admin/promotions${qs ? `?${qs}` : ''}`);
  },
  createPromotion: (body: Record<string, unknown>) =>
    apiClient('/admin/promotions', { method: 'POST', body: JSON.stringify(body) }),
  updatePromotion: (id: string, body: Record<string, unknown>) =>
    apiClient(`/admin/promotions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  clonePromotion: (id: string) =>
    apiClient(`/admin/promotions/${id}/clone`, { method: 'POST' }),
  bulkPromotions: (ids: string[], action: 'activate' | 'deactivate' | 'delete') =>
    apiClient('/admin/promotions/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, action }),
    }),
  exportPromotionsCsv: async () => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('platform_token') : null;
    const res = await fetch(`${API_BASE}/admin/promotions/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    return res.text();
  },

  getCallHistory: (params?: {
    q?: string;
    status?: string;
    type?: string;
    from?: string;
    to?: string;
    page?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.status) search.set('status', params.status);
    if (params?.type) search.set('type', params.type);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.page) search.set('page', String(params.page));
    const qs = search.toString();
    return apiClient<{
      analytics: {
        totalCalls: number;
        completedCalls: number;
        missedCalls: number;
        rejectedCalls: number;
        averageDurationSeconds: number;
        averageRevenueCoins: number;
        topHosts: Array<{ hostId: string; name: string; calls: number; earningsCoins: number }>;
        topUsers: Array<{ userId: string; name: string; calls: number; coinsSpent: number }>;
      };
      items: Array<{
        id: string;
        callId: string;
        type: string;
        displayStatus: string;
        durationSeconds: number;
        coinsSpent: number;
        hostEarning: number;
        createdAt: string;
        caller: { id: string; displayName: string; avatarUrl: string | null };
        host: { id: string; displayName: string; avatarUrl: string | null };
      }>;
      total: number;
      page: number;
      limit: number;
    }>(`/admin/calls${qs ? `?${qs}` : ''}`);
  },

  getCallHistoryDetail: (id: string) => apiClient(`/admin/calls/${id}`),

  gifts: () => apiClient<AdminGiftItem[]>('/admin/gifts'),
  giftAnalytics: () => apiClient<GiftAnalytics>('/admin/gifts/analytics'),
  createGift: (body: Record<string, unknown>) =>
    apiClient('/admin/gifts', { method: 'POST', body: JSON.stringify(body) }),
  updateGift: (id: string, body: Record<string, unknown>) =>
    apiClient(`/admin/gifts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  walletOverview: () =>
    apiClient<{
      walletCount: number;
      transactionCount: number;
      totalBalanceCoins: number;
    }>('/admin/wallet/overview'),

  walletTransactions: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const suffix = q.toString() ? `?${q}` : '';
    return apiClient<{ items: Array<{
      id: string;
      user: { displayName: string; email?: string | null };
      type: string;
      amountCoins: number;
      balanceAfterCoins: number;
      description?: string | null;
      createdAt: string;
    }> }>(`/admin/wallet/transactions${suffix}`);
  },

  adjustUserWallet: (
    userId: string,
    body: { amountCoins: number; action: 'credit' | 'debit' | 'refund'; reason?: string },
  ) =>
    apiClient(`/admin/wallet/users/${userId}/adjust`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listCoinPackages: () => apiClient('/admin/packages'),
  createCoinPackage: (body: Record<string, unknown>) =>
    apiClient('/admin/packages', { method: 'POST', body: JSON.stringify(body) }),
  updateCoinPackage: (id: string, body: Record<string, unknown>) =>
    apiClient(`/admin/packages/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  virtualHosts: () => apiClient<AdminVirtualHostItem[]>('/admin/virtual-hosts'),
  virtualHostAnalytics: () => apiClient<VirtualHostAnalytics>('/admin/virtual-hosts/analytics'),
  createVirtualHost: (body: Record<string, unknown>) =>
    apiClient<AdminVirtualHostItem>('/admin/virtual-hosts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateVirtualHost: (hostId: string, body: Record<string, unknown>) =>
    apiClient(`/admin/virtual-hosts/${hostId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setVirtualHostStatus: (hostId: string, status: string) =>
    apiClient(`/admin/virtual-hosts/${hostId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteVirtualHost: (hostId: string) =>
    apiClient(`/admin/virtual-hosts/${hostId}`, { method: 'DELETE' }),

  getVirtualHost: (hostId: string) =>
    apiClient<AdminVirtualHostItem>(`/admin/virtual-hosts/${hostId}`),

  getAiHostAssets: (hostId: string) =>
    apiClient<AiHostAssetsResponse>(`/admin/virtual-hosts/${hostId}/assets`),

  refreshAiHostAssets: (hostId: string) =>
    apiClient(`/admin/virtual-hosts/${hostId}/assets/refresh`, { method: 'POST' }),

  uploadAiHostVideo: (hostId: string, file: File) =>
    adminUploadFile(`/admin/virtual-hosts/${hostId}/videos`, file),

  uploadAiHostGallery: (hostId: string, file: File) =>
    adminUploadFile(`/admin/virtual-hosts/${hostId}/gallery`, file),

  uploadAiHostProfileImage: (hostId: string, file: File) =>
    adminUploadFile(`/admin/virtual-hosts/${hostId}/profile-image`, file),

  deleteAiHostGalleryImage: (hostId: string, imageId: string) =>
    apiClient(`/admin/virtual-hosts/${hostId}/gallery/${imageId}`, { method: 'DELETE' }),

  deleteAiHostVideo: (hostId: string, filename: string) =>
    apiClient(`/admin/virtual-hosts/${hostId}/videos/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    }),

  conversationAnalytics: (hostId?: string) =>
    apiClient(`/admin/virtual-hosts/conversation/analytics${hostId ? `?hostId=${hostId}` : ''}`),

  updateVirtualHostConversation: (hostId: string, body: Record<string, unknown>) =>
    apiClient(`/admin/virtual-hosts/${hostId}/conversation`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  resetVirtualHostMemory: (hostId: string, userId: string) =>
    apiClient(`/admin/virtual-hosts/${hostId}/memory/reset`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  listAIHostMemories: (hostId?: string, userId?: string) => {
    const q = new URLSearchParams();
    if (hostId) q.set('hostId', hostId);
    if (userId) q.set('userId', userId);
    const suffix = q.toString() ? `?${q}` : '';
    return apiClient<{ items: AIHostMemoryItem[] }>(`/admin/virtual-hosts/memory${suffix}`);
  },

  getAIHostMemory: (hostId: string, userId: string) =>
    apiClient<AIHostMemoryDetail>(`/admin/virtual-hosts/memory/${hostId}/${userId}`),

  updateAIHostMemory: (hostId: string, userId: string, body: Record<string, unknown>) =>
    apiClient(`/admin/virtual-hosts/memory/${hostId}/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteAIHostMemory: (hostId: string, userId: string) =>
    apiClient(`/admin/virtual-hosts/memory/${hostId}/${userId}`, { method: 'DELETE' }),

  getCallRoutingSettings: () =>
    apiClient<CallRoutingSettings>('/admin/settings/call-routing'),

  updateCallRoutingSettings: (body: Partial<CallRoutingSettings>) =>
    apiClient<CallRoutingSettings>('/admin/settings/call-routing', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  voiceAnalytics: (hostId?: string) =>
    apiClient(`/admin/virtual-hosts/voice/analytics${hostId ? `?hostId=${hostId}` : ''}`),

  testVirtualHostVoice: (body: Record<string, unknown>) =>
    apiClient('/admin/virtual-hosts/voice/test', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateVirtualHostVoice: (hostId: string, body: Record<string, unknown>) =>
    apiClient(`/admin/virtual-hosts/${hostId}/voice`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  avatarCatalog: () => apiClient('/admin/virtual-hosts/avatar/catalog'),

  updateVirtualHostAvatar: (hostId: string, body: Record<string, unknown>) =>
    apiClient(`/admin/virtual-hosts/${hostId}/avatar`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  previewVirtualHostAvatar: (body: Record<string, unknown>) =>
    apiClient('/admin/virtual-hosts/avatar/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  videoAvatarCatalog: () => apiClient('/admin/virtual-hosts/video-avatar/catalog'),

  updateVirtualHostVideo: (hostId: string, body: Record<string, unknown>) =>
    apiClient(`/admin/virtual-hosts/${hostId}/video`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  updateVirtualHostWardrobe: (hostId: string, body: Record<string, unknown>) =>
    apiClient(`/admin/virtual-hosts/${hostId}/wardrobe`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  activateVirtualHostOutfit: (hostId: string, outfitId: string) =>
    apiClient(`/admin/virtual-hosts/${hostId}/wardrobe/${outfitId}/activate`, {
      method: 'POST',
    }),
};

export interface AdminGiftItem {
  id: string;
  catalogId: string;
  slug: string;
  name: string;
  icon: string;
  category: string;
  coinPrice: number;
  animationTier: string;
  animationKey: string;
  popularity: number;
  sortOrder: number;
  isEnabled: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  isLimited: boolean;
  seasonTag: string | null;
}

export interface GiftAnalytics {
  totalGiftsSent: number;
  giftRevenueCoins: number;
  platformFeeCoins: number;
  averageGiftValueCoins: number;
  monthlyGiftCount: number;
  mostPopular: Array<{
    giftId: string;
    name: string;
    icon: string;
    count: number;
    revenueCoins: number;
  }>;
}

export interface AiHostGalleryImage {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
}

export interface AiHostAssetsResponse {
  assetSlug: string | null;
  videoCount: number;
  videos: Array<{ filename: string; url: string; type: string }>;
  galleryCount: number;
  gallery: AiHostGalleryImage[];
}

export interface AdminVirtualHostItem {
  hostId: string;
  profileType: string;
  virtualHostEnabled: boolean;
  virtualHostStatus: string | null;
  virtualHostPriority: number;
  virtualHostPopularity: number;
  virtualHostLanguage: string | null;
  virtualHostRegion: string | null;
  virtualHostGreeting: string | null;
  virtualHostAssetSlug?: string | null;
  virtualHostUsername?: string | null;
  virtualHostGallery?: AiHostGalleryImage[];
  videoCount?: number;
  createdAt?: string | null;
  age?: number | null;
  coinsPerMinute?: number | null;
  languages?: string[];
  isOnline: boolean;
  isBusy: boolean;
  totalCalls: number;
  rating: number | null;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    gender: string | null;
    primaryLanguage: string | null;
    status: string;
  };
  preview?: {
    greeting: string;
    displayName: string;
  };
}

export interface CallRoutingSettings {
  aiFallbackEnabled: boolean;
  realHostTimeoutSeconds: number;
  preferredRegion: string | null;
  preferredLanguage: string | null;
  randomAiSelection: boolean;
  defaultAiHostId: string | null;
  maxConcurrentAiSessions: number;
  videoCatalog: { hosts: number; clips: number };
  updatedAt: string;
}

export interface AIHostMemoryItem {
  id: string;
  hostId: string;
  userId: string;
  nickname: string | null;
  favoriteColor: string | null;
  favoriteFood: string | null;
  relationshipScore: number;
  callCount: number;
  memorySummary: string | null;
  tier: string;
  user: { id: string; displayName: string };
  host: { id: string; displayName: string };
}

export interface AIHostMemoryDetail {
  memory: AIHostMemoryItem & {
    favoriteMovie: string | null;
    favoriteMusic: string | null;
    favoriteOutfit: string | null;
    birthday: string | null;
    notes: string | null;
    lastCall: string | null;
  };
  conversationHistory: Array<{
    id: string;
    userMessage: string;
    aiReply: string;
    emotion: string | null;
    timestamp: string;
  }>;
}

export interface VirtualHostAnalytics {
  realHostCalls: number;
  virtualHostCalls: number;
  activeVirtualHosts: number;
  averageDurationSeconds: number;
  totalCoinsSpent: number;
  totalGiftsReceived: number;
  giftRevenueCoins: number;
  topVirtualHosts: Array<{
    hostId: string;
    displayName: string;
    sessions: number;
    coinsSpent: number;
    giftsReceived: number;
  }>;
}