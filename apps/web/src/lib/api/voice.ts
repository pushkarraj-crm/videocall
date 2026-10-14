import { apiClient } from './client';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export type VoiceStartResult = {
  streamId: string;
  format: string;
  mimeType: string;
  chunkCount: number;
  provider: string;
  estimatedSpeechMs: number;
};

export const voiceApi = {
  listVoices: (provider?: string) =>
    apiClient(`/virtual-hosts/voice/voices${provider ? `?provider=${provider}` : ''}`),

  start: (callId: string, text: string, eventType?: string) =>
    apiClient<VoiceStartResult>('/virtual-hosts/voice/start', {
      method: 'POST',
      body: JSON.stringify({ callId, text, eventType }),
    }),

  interrupt: (callId?: string, streamId?: string) =>
    apiClient<{ interrupted: boolean }>('/virtual-hosts/voice/interrupt', {
      method: 'POST',
      body: JSON.stringify({ callId, streamId }),
    }),

  stream(
    streamId: string,
    handlers: {
      onChunk: (index: number, audioBase64: string, mimeType: string) => void;
      onDone: (meta: {
        firstChunkMs: number | null;
        speechDurationMs: number;
        chunkCount: number;
      }) => void;
      onError?: (err: Error) => void;
    },
  ): () => void {
    const token = useAuthStore.getState().session?.accessToken;
    const url = `${API_BASE}/virtual-hosts/voice/stream/${streamId}`;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error('Voice stream failed');

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
              type?: string;
              data?: {
                type: string;
                index?: number;
                audio?: string;
                mimeType?: string;
                firstChunkMs?: number | null;
                speechDurationMs?: number;
                chunkCount?: number;
              };
              index?: number;
              audio?: string;
              mimeType?: string;
              firstChunkMs?: number | null;
              speechDurationMs?: number;
              chunkCount?: number;
            };
            const json = raw.data ?? raw;
            if (json.type === 'chunk' && json.audio != null && json.index != null) {
              handlers.onChunk(json.index, json.audio, json.mimeType ?? 'audio/wav');
            }
            if (json.type === 'done') {
              handlers.onDone({
                firstChunkMs: json.firstChunkMs ?? null,
                speechDurationMs: json.speechDurationMs ?? 0,
                chunkCount: json.chunkCount ?? 0,
              });
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