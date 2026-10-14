import { apiClient } from './client';
import type { HostDiscoverItem } from '@/types/api';

export interface FollowResult {
  following: boolean;
  followId?: string;
  hostId: string;
  followerCount: number;
  createdAt?: string;
}

export interface HostFollowersSummary {
  totalFollowers: number;
  followersThisWeek: number;
  followersThisMonth: number;
  repeatUsers: number;
  growthPercent: number | null;
  recentFollowers: Array<{
    id: string;
    userId: string;
    user: { id: string; displayName: string; avatarUrl: string | null };
    completedCalls: number;
    createdAt: string;
  }>;
  topFollowers: Array<{
    id: string;
    userId: string;
    user: { id: string; displayName: string; avatarUrl: string | null };
    completedCalls: number;
    createdAt: string;
  }>;
  dailyChart: Array<{ date: string; count: number }>;
}

export type FavoriteHostItem = HostDiscoverItem & {
  followedAt?: string | null;
  languages?: string[];
};

export const followsApi = {
  follow: (hostId: string) =>
    apiClient<FollowResult>(`/hosts/${hostId}/follow`, { method: 'POST' }),

  unfollow: (hostId: string) =>
    apiClient<FollowResult>(`/hosts/${hostId}/follow`, { method: 'DELETE' }),

  favorites: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'newest' | 'rating' | 'online';
  }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.search) search.set('search', params.search);
    if (params?.sort) search.set('sort', params.sort);
    const qs = search.toString();
    return apiClient<{
      items: FavoriteHostItem[];
      total: number;
      page: number;
      limit: number;
    }>(`/favorites${qs ? `?${qs}` : ''}`);
  },

  hostFollowers: () => apiClient<HostFollowersSummary>('/host/followers'),
};