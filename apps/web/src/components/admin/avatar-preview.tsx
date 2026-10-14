'use client';

import { useEffect, useMemo, useState } from 'react';
import { AvatarAnimatedPortrait } from '@/components/calls/avatar-animated-portrait';
import { useVirtualHostAvatar } from '@/hooks/use-virtual-host-avatar';
import type { AvatarAnimationSettings } from '@/lib/avatar/avatar-animation-engine';

export function AvatarPreview({
  imageUrl,
  displayName,
  settings,
  emotion = 'happy',
  mode = 'idle',
}: {
  imageUrl?: string | null;
  displayName: string;
  settings: Partial<AvatarAnimationSettings>;
  emotion?: string;
  mode?: 'idle' | 'speaking' | 'thinking' | 'gift';
}) {
  const [callEvent, setCallEvent] = useState<string | null>(null);
  const [giftCat, setGiftCat] = useState<string | null>(null);

  const merged = useMemo(() => settings, [settings]);

  useEffect(() => {
    if (mode === 'gift') {
      setGiftCat('luxury');
      setCallEvent(null);
    } else if (mode === 'thinking') {
      setCallEvent('typing');
      setGiftCat(null);
    } else {
      setCallEvent(null);
      setGiftCat(null);
    }
  }, [mode]);

  const { state } = useVirtualHostAvatar({
    settings: merged,
    emotion,
    speaking: mode === 'speaking',
    thinking: mode === 'thinking',
    connected: true,
    callEvent,
    giftCategory: giftCat,
    reactionsEnabled: settings.reactionsEnabled !== false,
  });

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-6">
      <AvatarAnimatedPortrait
        imageUrl={imageUrl}
        displayName={displayName}
        state={state}
        size="md"
      />
      <p className="text-xs text-[#A7A7B3]">
        Mode: {state.mode} · Emotion: {emotion}
      </p>
    </div>
  );
}