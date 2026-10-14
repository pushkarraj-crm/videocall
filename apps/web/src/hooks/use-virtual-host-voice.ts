'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceApi } from '@/lib/api/voice';

function playBase64Audio(base64: string, mimeType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Audio playback failed'));
    };
    void audio.play().catch(reject);
  });
}

export function useVirtualHostVoice(params: { callId: string; enabled: boolean }) {
  const { callId, enabled } = params;
  const [speaking, setSpeaking] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const interruptedRef = useRef(false);

  const interrupt = useCallback(() => {
    interruptedRef.current = true;
    abortRef.current?.();
    abortRef.current = null;
    setSpeaking(false);
    void voiceApi.interrupt(callId, streamIdRef.current ?? undefined);
    streamIdRef.current = null;
  }, [callId]);

  const speak = useCallback(
    async (text: string, eventType?: string) => {
      if (!enabled || !text.trim()) return;

      interrupt();
      interruptedRef.current = false;

      try {
        const start = await voiceApi.start(callId, text, eventType);
        streamIdRef.current = start.streamId;
        const chunks: Array<{ index: number; audio: string; mimeType: string }> = [];
        const streamStartedAt = Date.now();

        await new Promise<void>((resolve, reject) => {
          abortRef.current = voiceApi.stream(start.streamId, {
            onChunk: (index, audio, mimeType) => {
              if (interruptedRef.current) return;
              chunks.push({ index, audio, mimeType });
              if (chunks.length === 1) {
                setLastLatencyMs(Date.now() - streamStartedAt);
              }
            },
            onDone: (meta) => {
              if (meta.firstChunkMs != null) setLastLatencyMs(meta.firstChunkMs);
              resolve();
            },
            onError: reject,
          });
        });

        if (interruptedRef.current) return;

        const sorted = [...chunks].sort((a, b) => a.index - b.index);
        setSpeaking(true);
        for (const chunk of sorted) {
          if (interruptedRef.current) break;
          queueRef.current = queueRef.current.then(() =>
            playBase64Audio(chunk.audio, chunk.mimeType),
          );
          await queueRef.current;
        }
        setSpeaking(false);
        streamIdRef.current = null;
      } catch {
        setSpeaking(false);
        streamIdRef.current = null;
      }
    },
    [callId, enabled, interrupt],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  return { speaking, lastLatencyMs, speak, interrupt };
}