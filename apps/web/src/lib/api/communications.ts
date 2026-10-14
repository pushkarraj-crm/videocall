import { apiClient } from './client';

export interface CommunicationSettings {
  marketingEmails: boolean;
  marketingSms: boolean;
  transactionalEmails: boolean;
  transactionalSms: boolean;
  securityEmails: boolean;
  securitySms: boolean;
  promotionEmails: boolean;
  promotionSms: boolean;
  referralUpdates: boolean;
}

export type CommunicationAudience =
  | 'all_users'
  | 'hosts'
  | 'users'
  | 'verified_hosts'
  | 'vip_users'
  | 'single_user';

export const communicationsApi = {
  getSettings: () => apiClient<CommunicationSettings>('/communications/settings'),

  updateSettings: (body: Partial<CommunicationSettings>) =>
    apiClient<CommunicationSettings>('/communications/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  adminList: (page = 1) =>
    apiClient<{
      items: Array<{
        id: string;
        channel: string;
        title: string;
        audience: string;
        status: string;
        recipientCount: number;
        deliveredCount: number;
        openedCount: number;
        clickedCount: number;
        createdAt: string;
      }>;
      total: number;
    }>(`/admin/communications?page=${page}`),

  adminAnalytics: () =>
    apiClient<{
      totalEmails: number;
      deliveryRate: number;
      openRate: number;
      clickRate: number;
      bounceRate: number;
      smsDeliveryRate: number;
      totalSms: number;
      dailyEmails: number;
      weeklyEmails: number;
      monthlyEmails: number;
    }>('/admin/communications/analytics'),

  adminLogs: (params?: { page?: number; limit?: number; channel?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.channel) search.set('channel', params.channel);
    if (params?.status) search.set('status', params.status);
    const qs = search.toString();
    return apiClient<{
      items: Array<{
        id: string;
        channel: string;
        eventType: string;
        template: string | null;
        provider: string | null;
        recipient: string;
        status: string;
        createdAt: string;
      }>;
      total: number;
    }>(`/admin/communications/logs${qs ? `?${qs}` : ''}`);
  },

  sendEmail: (data: {
    title: string;
    subject: string;
    body: string;
    htmlBody?: string;
    audience: CommunicationAudience;
    targetUserId?: string;
    scheduledAt?: string;
    draft?: boolean;
    preview?: boolean;
  }) =>
    apiClient('/admin/email', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendSms: (data: {
    title: string;
    body: string;
    audience: CommunicationAudience;
    targetUserId?: string;
    scheduledAt?: string;
    draft?: boolean;
    preview?: boolean;
  }) =>
    apiClient('/admin/sms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};