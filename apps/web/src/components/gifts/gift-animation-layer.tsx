'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { GiftAnimationTier, GiftSentEvent } from '@/lib/gifts/types';

interface ActiveAnimation extends GiftSentEvent {
  key: string;
}

const TIER_Z: Record<GiftAnimationTier, string> = {
  floating: 'z-30',
  center: 'z-40',
  fullscreen: 'z-50',
  cinematic: 'z-[60]',
};

function AnimationContent({ event }: { event: GiftSentEvent }) {
  const { animationKey, animationTier, icon, name } = event.gift;
  const qty = event.quantity;

  if (animationTier === 'cinematic') {
    return (
      <div className="gift-anim-cinematic pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm">
        <div className="gift-anim-cinematic-pop text-center">
          <span className="block text-7xl drop-shadow-[0_0_40px_rgba(255,46,116,0.8)]">{icon}</span>
          <p className="mt-4 text-2xl font-bold text-white">{name}</p>
          {qty > 1 && <p className="text-lg text-[#FFB347]">×{qty}</p>}
          <p className="mt-2 text-sm text-[#A7A7B3]">from {event.sender.displayName}</p>
        </div>
      </div>
    );
  }

  if (animationTier === 'fullscreen') {
    return (
      <div className="gift-anim-fullscreen pointer-events-none absolute inset-x-0 top-1/3 z-50 flex justify-center">
        <div className="gift-anim-drive flex items-center gap-3 rounded-full bg-black/50 px-6 py-3 backdrop-blur-md">
          <span className="text-5xl">{icon}</span>
          <div>
            <p className="font-bold text-white">{name}</p>
            <p className="text-xs text-[#FFB347]">
              {event.sender.displayName}
              {qty > 1 ? ` · ×${qty}` : ''}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (animationTier === 'center') {
    return (
      <div className="gift-anim-center pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="gift-anim-center-pop flex flex-col items-center rounded-3xl bg-black/40 px-8 py-6 backdrop-blur-md">
          <span className="text-6xl">{icon}</span>
          <p className="mt-2 font-semibold text-white">{name}</p>
          {qty > 1 && <span className="text-[#FFB347]">×{qty}</span>}
        </div>
      </div>
    );
  }

  // floating + key-specific accents
  const floatingClass =
    animationKey === 'rose_petals'
      ? 'gift-anim-petals'
      : animationKey === 'heart_burst'
        ? 'gift-anim-heart'
        : animationKey === 'diamond_sparkle'
          ? 'gift-anim-sparkle'
          : 'gift-anim-float';

  return (
    <div
      className={cn(
        'gift-anim-floating pointer-events-none absolute bottom-28 right-6 flex items-center gap-2 rounded-2xl bg-black/45 px-4 py-3 backdrop-blur-md',
        floatingClass,
      )}
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="text-[10px] text-[#A7A7B3]">
          {event.sender.displayName}
          {qty > 1 ? ` ×${qty}` : ''}
        </p>
      </div>
    </div>
  );
}

export function GiftAnimationLayer({ events }: { events: GiftSentEvent[] }) {
  const [active, setActive] = useState<ActiveAnimation[]>([]);

  useEffect(() => {
    if (!events.length) return;
    const latest = events[events.length - 1];
    const key = `${latest.id}-${Date.now()}`;
    const tier = latest.gift.animationTier;
    const duration =
      tier === 'cinematic' ? 3200 : tier === 'fullscreen' ? 2800 : tier === 'center' ? 2200 : 1800;

    setActive((prev) => [...prev.slice(-2), { ...latest, key }]);
    const timer = setTimeout(() => {
      setActive((prev) => prev.filter((a) => a.key !== key));
    }, duration);
    return () => clearTimeout(timer);
  }, [events]);

  if (!active.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {active.map((event) => (
        <div key={event.key} className={cn('absolute inset-0', TIER_Z[event.gift.animationTier])}>
          <AnimationContent event={event} />
        </div>
      ))}
    </div>
  );
}