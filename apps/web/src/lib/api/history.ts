import { apiClient } from './client';

export interface CallHistoryListItem {
  id: string;
  callId: string;
  type: 'audio' | 'video';
  displayStatus: string;
  durationSeconds: number;
  coinsSpent: number;
  coinsEarned?: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  host?: { id: string; displayName: string; avatarUrl: string | null };
  caller?: { id: string; displayName: string; avatarUrl: string | null };
}

export interface CallHistoryDetail {
  id: string;
  callId: string;
  type: 'audio' | 'video';
  displayStatus: string;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  coinsSpent: number;
  hostEarning: number;
  platformCommission: number;
  endedBy: string | null;
  createdAt: string;
  caller: { id: string; displayName: string; avatarUrl: string | null };
  host: { id: string; displayName: string; avatarUrl: string | null };
}

export const historyApi = {
  list: (page = 1, limit = 20) =>
    apiClient<{ items: CallHistoryListItem[]; total: number; page: number; limit: number }>(
      `/history?page=${page}&limit=${limit}`,
    ),

  get: (id: string) => apiClient<CallHistoryDetail>(`/history/${id}`),

  hostList: (params?: {
    page?: number;
    period?: string;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.period) search.set('period', params.period);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiClient<{ items: CallHistoryListItem[]; total: number }>(
      `/host/history${qs ? `?${qs}` : ''}`,
    );
  },
};