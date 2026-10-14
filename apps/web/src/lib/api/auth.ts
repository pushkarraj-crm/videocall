import { apiClient } from './client';
import type { AuthSession, UserProfile } from '@/types/api';
import type { CompleteOnboardingPayload } from '@/types/onboarding';

export const authApi = {
  methods: () => apiClient<{ google: boolean; phone: boolean }>('/auth/methods', { auth: false }),
  login: (email: string, password: string, intent?: string) =>
    apiClient<AuthSession>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, intent }),
    }),
  register: (email: string, password: string, displayName: string) =>
    apiClient<AuthSession>('/auth/register', { method: 'POST', auth: false, body: JSON.stringify({ email, password, displayName }) }),
  forgotPassword: (email: string) =>
    apiClient<{ message: string }>('/auth/forgot-password', { method: 'POST', auth: false, body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    apiClient<{ message: string }>('/auth/reset-password', { method: 'POST', auth: false, body: JSON.stringify({ token, password }) }),
  verifyEmail: (token: string) =>
    apiClient<{ message: string }>('/auth/verify-email', { method: 'POST', auth: false, body: JSON.stringify({ token }) }),
  requestOtp: (phone: string, intent?: string) =>
    apiClient<{ challengeId: string; expiresIn: number; resendAfter: number }>('/auth/phone/request', { method: 'POST', auth: false, body: JSON.stringify({ phone, intent }) }),
  verifyOtp: (challengeId: string, code: string) =>
    apiClient<AuthSession>('/auth/phone/verify', { method: 'POST', auth: false, body: JSON.stringify({ challengeId, code }) }),
  exchangeGoogle: (token: string) =>
    apiClient<AuthSession>('/auth/google/exchange', { method: 'POST', auth: false, body: JSON.stringify({ token }) }),
  googleStartUrl: (intent = 'user') => `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'}/auth/google/start?intent=${encodeURIComponent(intent)}`,

  completeOnboarding: (payload: CompleteOnboardingPayload) =>
    apiClient<{ user: UserProfile; onboardingComplete: boolean }>(
      '/auth/complete-onboarding',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getMe: () => apiClient<UserProfile>('/auth/me'),

  devLogin: (payload?: {
    phone?: string;
    displayName?: string;
    role?: 'user' | 'host' | 'admin';
    seedCoins?: number;
  }) =>
    apiClient<AuthSession>('/auth/dev-login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload ?? {}),
    }),

  refresh: (refreshToken: string) =>
    apiClient<AuthSession>('/auth/refresh', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken?: string) =>
    apiClient<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ refreshToken }),
    }),
};
