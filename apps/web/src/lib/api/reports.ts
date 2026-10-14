import { apiClient } from './client';

export type ReportItem = {
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
  createdAt: string;
  updatedAt: string;
  riskLevel?: string;
  reportedUser?: { id: string; displayName: string; avatarUrl: string | null };
};

export const reportsApi = {
  create: (data: {
    reportedId: string;
    category: string;
    description?: string;
    callId?: string;
    messageId?: string;
  }) =>
    apiClient<ReportItem>('/reports', { method: 'POST', body: JSON.stringify(data) }),

  listMine: (page = 1, limit = 20) =>
    apiClient<{ items: ReportItem[]; total: number; page: number; limit: number }>(
      `/reports/me?page=${page}&limit=${limit}`,
    ),

  block: (userId: string, reason?: string) =>
    apiClient('/blocks', {
      method: 'POST',
      body: JSON.stringify({ userId, reason }),
    }),

  listBlocks: () => apiClient('/blocks'),

  unblock: (userId: string) =>
    apiClient(`/blocks/${userId}`, { method: 'DELETE' }),
};