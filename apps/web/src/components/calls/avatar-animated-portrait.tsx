'use client';

import Image from 'next/image';
import type { AvatarAnimState } from '@/hooks/use-virtual-host-avatar';
import { cn } from '@/lib/utils';

interface AvatarAnimatedPortraitProps {
  imageUrl?: string | null;
  displayName: string;
  state: AvatarAnimState;
  size?: 'md' | 'lg';
}

export function AvatarAnimatedPortrait({
  imageUrl,
  displayName,
  state,
  size = 'lg',
}: AvatarAnimatedPortraitProps) {
  const { mode, idleAnim, reaction, expression, speaking, blinking, zoom, standUp } = state;
  const sizeClass = size === 'lg' ? 'h-48 w-48 sm:h-56 sm:w-56' : 'h-32 w-32';

  const transform = [
    `scale(${zoom})`,
    standUp ? 'translateY(-8px)' : '',
    `rotate(${expression.headTiltDeg}deg)`,
    `translate(${expression.lookX}px, ${expression.lookY}px)`,
    mode === 'speaking' ? `translateY(${-speaking.bob * 20}px)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cn(
        'vh-avatar-stage relative transition-transform duration-300',
        sizeClass,
        standUp && 'vh-avatar-stand-up',
        reaction && `vh-avatar-react-${reaction}`,
        mode === 'idle' && `vh-avatar-idle-${idleAnim}`,
        mode === 'speaking' && 'vh-avatar-speaking',
        mode === 'thinking' && 'vh-avatar-thinking',
      )}
      style={{
        transform: `scale(${zoom})`,
        filter: `brightness(${expression.brightness})`,
        willChange: 'transform',
      }}
    >
      <div
        className="vh-avatar-body relative h-full w-full overflow-hidden rounded-full border-4 border-[#FF2E74]/40 shadow-[0_0_60px_rgba(255,46,116,0.25)]"
        style={{ transform, willChange: 'transform' }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName}
            fill
            className="object-cover"
            sizes="224px"
            loading="lazy"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#17171C] text-4xl">
            ✨
          </div>
        )}

        <div className="vh-avatar-hair pointer-events-none absolute inset-0" aria-hidden />
        <div
          className={cn('vh-avatar-eyes pointer-events-none absolute inset-0', blinking && 'vh-avatar-blink')}
          aria-hidden
        >
          <span className="vh-eye vh-eye-left" style={{ transform: `scaleY(${expression.eyeScale})` }} />
          <span className="vh-eye vh-eye-right" style={{ transform: `scaleY(${expression.eyeScale})` }} />
        </div>
        <div
          className="vh-avatar-brows pointer-events-none absolute inset-0"
          style={{ transform: `translateY(${expression.browOffset}px)` }}
          aria-hidden
        >
          <span className="vh-brow vh-brow-left" />
          <span className="vh-brow vh-brow-right" />
        </div>
        <div
          className="vh-avatar-mouth pointer-events-none absolute"
          style={{
            transform: `scaleY(${0.35 + Math.max(0, expression.mouthCurve) * 0.5 + speaking.jaw * 0.6}) scaleX(${0.9 + expression.mouthCurve * 0.15})`,
          }}
          aria-hidden
        />
        {reaction === 'heart' && (
          <div className="vh-avatar-heart-overlay pointer-events-none absolute inset-0" aria-hidden />
        )}
      </div>
    </div>
  );
}