import { apiClient } from './client';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export type ConversationTurn = {
  id: string;
  role: string;
  eventType: string;
  content: string;
  emotion?: string | null;
  responseMs?: number | null;
  createdAt: string;
};

export const conversationApi = {
  preload: (callId: string) => apiClient(`/virtual-hosts/conversation/${callId}/context`),

  history: (callId: string) =>
    apiClient<{ turns: ConversationTurn[] }>(`/virtual-hosts/conversation/${callId}/history`),

  message: (callId: string, message: string, clientTurnId?: string) =>
    apiClient<{
      turnId: string;
      text: string;
      emotion: string;
      responseMs: number;
      speaking: boolean;
    }>(`/virtual-hosts/conversation/${callId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message, clientTurnId }),
    }),

  event: (callId: string, eventType: string, giftName?: string) =>
    apiClient<{
      turnId: string;
      text: string;
      emotion: string;
      responseMs: number;
      eventType: string;
    }>(`/virtual-hosts/conversation/${callId}/event`, {
      method: 'POST',
      body: JSON.stringify({ eventType, giftName }),
    }),

  interrupt: (callId: string) =>
    apiClient<{ interrupted: boolean }>(`/virtual-hosts/conversation/${callId}/interrupt`, {
      method: 'POST',
    }),

  stream(
    callId: string,
    message: string,
    handlers: {
      onChunk: (text: string, emotion?: string) => void;
      onDone: (full: { text: string; emotion: string; turnId?: string }) => void;
      onError?: (err: Error) => void;
    },
  ): () => void {
    const token = useAuthStore.getState().session?.accessToken;
    const url = `${API_BASE}/virtual-hosts/conversation/${callId}/stream?message=${encodeURIComponent(message)}`;
    const source = new EventSource(url, token ? { withCredentials: false } : undefined);

    // EventSource doesn't support auth headers — use fetch stream fallback
    source.close();

    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error('Stream failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            const raw = JSON.parse(dataLine.slice(5).trim()) as {
              data?: { type: string; text?: string; emotion?: string; turnId?: string };
              type?: string;
              text?: string;
              emotion?: string;
              turnId?: string;
            };
            const json = raw.data ?? raw;
            if (json.type === 'chunk' && json.text) handlers.onChunk(json.text, json.emotion);
            if (json.type === 'done' && json.text) {
              handlers.onDone({ text: json.text, emotion: json.emotion ?? 'happy', turnId: json.turnId });
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') handlers.onError?.(e as Error);
      }
    })();

    return () => controller.abort();
  },
};