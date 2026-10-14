'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { conversationApi } from '@/lib/api/conversation';
import { logBackgroundApiFailure, retryBackground } from '@/lib/api/background';
import { useVirtualHostVoice } from '@/hooks/use-virtual-host-voice';

export type ConversationLine = {
  role: 'user' | 'assistant';
  text: string;
  emotion?: string;
  streaming?: boolean;
};

export function useVirtualHostConversation(params: {
  callId: string;
  enabled: boolean;
  onGiftReaction?: (giftName: string) => void;
}) {
  const { callId, enabled } = params;
  const [lines, setLines] = useState<ConversationLine[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<string>('happy');
  const greetedRef = useRef(false);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const voice = useVirtualHostVoice({ callId, enabled });

  const pushAssistant = useCallback((text: string, emo?: string, streaming = false) => {
    setEmotion(emo ?? 'happy');
    setCurrentSubtitle(text);
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (streaming && last?.role === 'assistant' && last.streaming) {
        return [...prev.slice(0, -1), { ...last, text, emotion: emo, streaming: true }];
      }
      return [...prev, { role: 'assistant', text, emotion: emo, streaming }];
    });
  }, []);

  const sendEvent = useCallback(
    async (eventType: string, giftName?: string) => {
      if (!enabled) return;
      try {
        setThinking(true);
        const res = await conversationApi.event(callId, eventType, giftName);
        setThinking(false);
        setSpeaking(true);
        pushAssistant(res.text, res.emotion, false);
        setSpeaking(false);
        void voice.speak(res.text, eventType);
      } catch {
        setThinking(false);
      }
    },
    [callId, enabled, pushAssistant, voice],
  );

  const sendMessage = useCallback(
    (message: string) => {
      if (!enabled || !message.trim()) return;
      setLines((prev) => [...prev, { role: 'user', text: message }]);
      setThinking(true);
      setSpeaking(false);

      abortRef.current?.();
      let accumulated = '';
      abortRef.current = conversationApi.stream(callId, message, {
        onChunk: (chunk, emo) => {
          setThinking(false);
          setSpeaking(true);
          accumulated += chunk;
          pushAssistant(accumulated, emo, true);
        },
        onDone: (full) => {
          setSpeaking(false);
          pushAssistant(full.text, full.emotion, false);
          void voice.speak(full.text, 'message');
        },
        onError: () => {
          setThinking(false);
          void conversationApi
            .message(callId, message)
            .then((res) => {
              pushAssistant(res.text, res.emotion, false);
              void voice.speak(res.text, 'message');
            })
            .catch((err) =>
              logBackgroundApiFailure(
                `/virtual-hosts/conversation/${callId}/message`,
                err,
              ),
            );
        },
      });
    },
    [callId, enabled, pushAssistant, voice],
  );

  const interrupt = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setSpeaking(false);
    voice.interrupt();
    void conversationApi.interrupt(callId).catch((err) =>
      logBackgroundApiFailure(`/virtual-hosts/conversation/${callId}/interrupt`, err),
    );
  }, [callId, voice]);

  useEffect(() => {
    if (!enabled || greetedRef.current) return;
    greetedRef.current = true;
    void retryBackground(`/virtual-hosts/conversation/${callId}/context`, () =>
      conversationApi.preload(callId),
    );
    void sendEvent('greeting');
  }, [callId, enabled, sendEvent]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.();
      abortRef.current = null;
      if (silenceRef.current) clearTimeout(silenceRef.current);
      setSpeaking(false);
      setThinking(false);
      return;
    }
    const resetSilence = () => {
      if (silenceRef.current) clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => {
        void sendEvent('long_silence');
      }, 45_000);
    };
    resetSilence();
    return () => {
      if (silenceRef.current) clearTimeout(silenceRef.current);
    };
  }, [enabled, lines.length, sendEvent]);

  useEffect(() => {
    return () => {
      abortRef.current?.();
    };
  }, []);

  return {
    lines,
    speaking: speaking || voice.speaking,
    thinking,
    currentSubtitle,
    emotion,
    sendMessage,
    sendEvent,
    interrupt,
    voiceLatencyMs: voice.lastLatencyMs,
  };
}