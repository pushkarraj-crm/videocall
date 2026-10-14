'use client';

import { useEffect, useRef } from 'react';
import type { NotificationStreamEvent } from '@/types/notifications';
import {
  cacheNotificationSettings,
  requestNotificationPermission,
  showBrowserNotification,
} from '@/lib/notifications/browser-push';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationsStore } from '@/stores/notifications-store';
import { useCallStore } from '@/stores/call-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export function useNotifications() {
  const session = useAuthStore((s) => s.session);
  const fetchInitial = useNotificationsStore((s) => s.fetchInitial);
  const prependNotification = useNotificationsStore((s) => s.prependNotification);
  const setUnreadCount = useNotificationsStore((s) => s.setUnreadCount);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!session) return;

    void fetchInitial();
    void requestNotificationPermission();
    void notificationsApi.getSettings().then((s) => cacheNotificationSettings(s)).catch(() => {});
  }, [session, fetchInitial]);

  useEffect(() => {
    if (!session) return;

    const token = localStorage.getItem('platform_token');
    if (!token) return;

    let cancelled = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const connect = async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';

          for (const chunk of chunks) {
            const dataLine = chunk
              .split('\n')
              .find((line) => line.startsWith('data:'));
            if (!dataLine) continue;

            const payload = JSON.parse(
              dataLine.replace(/^data:\s*/, ''),
            ) as NotificationStreamEvent;

            if (payload.event === 'notification') {
              prependNotification(payload.notification);
              showBrowserNotification(payload.notification);
            } else if (payload.event === 'unread_count') {
              setUnreadCount(payload.count);
            } else if (payload.event === 'incoming_call') {
              useCallStore.getState().setIncomingCall({
                callId: payload.callId,
                callerId: payload.callerId,
                callerName: payload.callerName,
              });
            } else if (payload.event === 'call_status') {
              const incoming = useCallStore.getState().incomingCall;
              if (
                incoming?.callId === payload.callId &&
                payload.status !== 'initiated' &&
                payload.status !== 'ringing'
              ) {
                useCallStore.getState().setIncomingCall(null);
              }
              window.dispatchEvent(new CustomEvent('platform:call-status', { detail: payload }));
            } else if (payload.event === 'call_gift') {
              window.dispatchEvent(new CustomEvent('platform:call-gift', { detail: payload }));
            }
          }
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setTimeout(() => {
            if (!cancelled) void connect();
          }, 5000);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [session, prependNotification, setUnreadCount]);
}
