import { apiClient } from './client';

export const referralsApi = {
  getMe: () => apiClient<{ referralCode?: string; stats: unknown[] }>('/referrals/me'),

  apply: (referralCode: string) =>
    apiClient('/referrals/apply', {
      method: 'POST',
      body: JSON.stringify({ referralCode }),
    }),
};