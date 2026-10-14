'use client';

import { cn } from '@/lib/utils';

export function GiftComboBadge({
  icon,
  giftId,
  count,
}: {
  icon: string;
  giftId: string;
  count: number;
}) {
  if (count < 2) return null;

  const isMega = count >= 25;
  const isSuper = count >= 10;

  return (
    <div
      className={cn(
        'gift-combo-badge pointer-events-none absolute left-1/2 top-24 z-[55] -translate-x-1/2',
        isMega && 'gift-combo-mega',
        isSuper && !isMega && 'gift-combo-super',
      )}
    >
      <div className="flex items-center gap-2 rounded-full bg-black/60 px-5 py-2.5 backdrop-blur-md ring-2 ring-[#FF2E74]/50">
        <span className="text-2xl">{icon}</span>
        <span className="text-lg font-black text-white">
          {icon} ×{count}
        </span>
      </div>
    </div>
  );
}