import type {
  AnnouncementTarget,
  AppNotification,
  NotificationListResponse,
  NotificationPriority,
} from '@/types/notifications';
import { apiClient } from './client';

export interface NotificationSettings {
  incomingCalls: boolean;
  recharge: boolean;
  referral: boolean;
  promotions: boolean;
  withdrawals: boolean;
  kyc: boolean;
  reviews: boolean;
  announcements: boolean;
  browserPush: boolean;
  sound: boolean;
  vibration: boolean;
}

export const notificationsApi = {
  list: (params?: { page?: number; limit?: number; cursor?: string }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.cursor) search.set('cursor', params.cursor);
    const qs = search.toString();
    return apiClient<NotificationListResponse>(
      `/notifications${qs ? `?${qs}` : ''}`,
    );
  },

  unreadCount: () => apiClient<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiClient<{ notification: AppNotification; unreadCount: number }>(
      `/notifications/${id}/read`,
      { method: 'PATCH' },
    ),

  markAllRead: () =>
    apiClient<{ unreadCount: number }>('/notifications/read-all', { method: 'PATCH' }),

  delete: (id: string) =>
    apiClient<{ deleted: boolean; unreadCount: number }>(`/notifications/${id}`, {
      method: 'DELETE',
    }),

  getSettings: () => apiClient<NotificationSettings>('/notifications/settings'),

  updateSettings: (body: Partial<NotificationSettings>) =>
    apiClient<NotificationSettings>('/notifications/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  registerDevice: (token: string, platform: 'web' | 'android' | 'ios' = 'web') =>
    apiClient('/notifications/devices', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  unregisterDevice: (token: string) =>
    apiClient('/notifications/devices', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }),

  listDevices: () =>
    apiClient<{ id: string; platform: string; lastUsedAt: string }[]>('/notifications/devices'),

  adminList: (page = 1) =>
    apiClient<{
      items: Array<{
        id: string;
        title: string;
        status: string;
        recipientCount: number;
        readCount: number;
        clickCount: number;
        createdAt: string;
      }>;
      total: number;
    }>(`/admin/notifications?page=${page}`),

  adminAnalytics: () =>
    apiClient<{
      notificationsSent: number;
      read: number;
      clicked: number;
      ctr: number;
      unreadPercent: number;
      dailySent: number;
      weeklySent: number;
      monthlySent: number;
    }>('/admin/notifications/analytics'),

  createBroadcast: (data: {
    title: string;
    message: string;
    target: AnnouncementTarget;
    priority?: NotificationPriority;
    userId?: string;
    scheduledAt?: string;
    draft?: boolean;
    preview?: boolean;
  }) =>
    apiClient('/admin/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendAnnouncement: (data: {
    title: string;
    message: string;
    target: AnnouncementTarget;
    priority?: NotificationPriority;
    userId?: string;
  }) =>
    apiClient<{ sent: number; targetUserIds: string[] }>('/admin/notifications/announce', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};