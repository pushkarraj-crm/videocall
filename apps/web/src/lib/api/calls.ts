import { apiClient } from './client';
import type { CallInitiateResponse, HostProfileType, VirtualHostMeta } from '@/types/api';

export const callsApi = {
  initiate: (calleeId: string) =>
    apiClient<CallInitiateResponse>('/calls/initiate', {
      method: 'POST',
      body: JSON.stringify({ calleeId }),
    }),

  match: (body?: { preferredLanguage?: string; preferredRegion?: string }) =>
    apiClient<CallInitiateResponse>('/calls/match', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  consent: (callId: string, documentVersion: string) =>
    apiClient('/calls/' + callId + '/consent', {
      method: 'POST',
      body: JSON.stringify({ documentVersion }),
    }),

  accept: (callId: string) =>
    apiClient('/calls/' + callId + '/accept', { method: 'POST' }),

  reject: (callId: string) =>
    apiClient('/calls/' + callId + '/reject', { method: 'POST' }),

  end: (callId: string) =>
    apiClient('/calls/' + callId + '/end', { method: 'POST' }),

  getCall: (callId: string) =>
    apiClient<{
      id: string;
      callerId: string;
      calleeId: string;
      status: string;
      isFreeCall: boolean;
      startedAt: string | null;
      endedAt?: string | null;
      zegoRoomId: string;
      hasConsented?: boolean;
      isVirtualHost?: boolean;
      profileType?: HostProfileType;
      virtualHost?: VirtualHostMeta;
      zego: { token: string; appId: string; roomId: string; userId?: string; expireSeconds?: number };
    }>('/calls/' + callId),

  billingTick: (callId: string) =>
    apiClient<{
      billed: boolean;
      reason?: string;
      balanceCoins?: number;
      coinsPerMinute?: number;
      lowBalance?: boolean;
    }>('/calls/' + callId + '/billing-tick', { method: 'POST' }),

  sendGift: (callId: string, giftId: string) =>
    apiClient<{ gift: { id: string; giftType: string }; balanceCoins: number }>(
      '/calls/' + callId + '/gifts',
      { method: 'POST', body: JSON.stringify({ giftId }) },
    ),

  history: (page = 1) =>
    apiClient<{ items: unknown[]; total: number }>(`/calls?page=${page}&limit=20`),

  incoming: () =>
    apiClient<{
      calls: {
        callId: string;
        callerId: string;
        callerName: string;
        callerAvatar?: string | null;
        roomId: string;
        isFreeCall: boolean;
        createdAt: string;
      }[];
    }>('/calls/incoming'),
};