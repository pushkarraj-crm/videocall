'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LocalVideoPlayer } from '@/components/calls/local-video-player';
import type { AvatarAnimState } from '@/hooks/use-virtual-host-avatar';
import { useLocalVideoPlayer } from '@/hooks/use-local-video-player';
import { useVideoAvatar } from '@/hooks/use-video-avatar';
import type { VideoAvatarSettings, WardrobeOutfit } from '@/lib/video-avatar/video-avatar-engine';
import { cn } from '@/lib/utils';

interface VideoAvatarProps {
  displayName: string;
  imageUrl?: string | null;
  avatarState: AvatarAnimState;
  settings: VideoAvatarSettings;
  outfit?: WardrobeOutfit | null;
  emotion?: string;
  speaking?: boolean;
  thinking?: boolean;
  subtitle?: string | null;
  clips?: Partial<Record<string, string>>;
  hostSlug?: string;
  sceneSlug?: string;
  callEvent?: string | null;
  giftCategory?: string | null;
  giftTier?: string | null;
  lockedVideoUrl?: string | null;
}

export function VideoAvatar({
  displayName,
  imageUrl,
  avatarState,
  settings,
  outfit,
  emotion = 'happy',
  speaking = false,
  thinking = false,
  subtitle,
  clips,
  hostSlug,
  sceneSlug = 'bedroom',
  callEvent,
  giftCategory,
  giftTier,
  lockedVideoUrl,
}: VideoAvatarProps) {
  const [speakTick, setSpeakTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  const video = useVideoAvatar({
    avatarState,
    settings,
    emotion,
    speaking,
    thinking,
    subtitle,
    speakTick,
  });

  useEffect(() => {
    if (!speaking) {
      setSpeakTick(0);
      return;
    }
    const loop = () => {
      setSpeakTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [speaking]);

  const localPlayer = useLocalVideoPlayer({
    displayName,
    hostSlug,
    outfit: outfit?.category ?? 'casual',
    scene: sceneSlug,
    enabled: true,
    lockedVideoUrl,
  });

  const sessionVideoUrl = useMemo(
    () => localPlayer.state.sessionVideoUrl ?? lockedVideoUrl ?? null,
    [localPlayer.state.sessionVideoUrl, lockedVideoUrl],
  );

  const showLocalVideo = Boolean(
    lockedVideoUrl || sessionVideoUrl || localPlayer.state.usingLocalAssets,
  );

  const visualUrl = outfit?.imageUrl ?? imageUrl;
  const clipUrl =
    (speaking ? outfit?.videoTalkUrl : outfit?.videoIdleUrl) ??
    clips?.[video.pose] ??
    clips?.idle;
  const useVideoElement = settings.renderMode === 'video' && Boolean(clipUrl);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !useVideoElement) return;
    el.load();
    void el.play().catch(() => undefined);
  }, [clipUrl, useVideoElement, video.pose]);

  return (
    <div
      className={cn(
        'vh-video-stage relative w-full max-w-md overflow-hidden',
        `vh-video-camera-${video.cameraMode}`,
        `vh-video-pose-${video.pose}`,
        speaking && 'vh-video-speaking',
        video.reaction && `vh-video-react-${video.reaction}`,
        !speaking && `vh-video-idle-${video.idleAnim}`,
        settings.idleDrift !== false && 'vh-video-drift',
      )}
      style={{
        transform: `translate3d(0, ${video.translateY}px, 0) scale(${video.zoom})`,
        willChange: 'transform',
      }}
    >
      <div className="vh-video-frame relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121218] shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
        <div className="vh-video-vignette pointer-events-none absolute inset-0 z-20" aria-hidden />
        <div className="vh-video-scanline pointer-events-none absolute inset-0 z-20 opacity-[0.04]" aria-hidden />

        {showLocalVideo ? (
          <LocalVideoPlayer videoUrl={sessionVideoUrl} className="h-full w-full" />
        ) : useVideoElement && clipUrl ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={clipUrl}
            muted
            playsInline
            loop
            preload="none"
          />
        ) : visualUrl ? (
          <Image
            src={visualUrl}
            alt={displayName}
            fill
            className="object-cover object-[center_20%]"
            sizes="(max-width: 768px) 100vw, 400px"
            loading="lazy"
            unoptimized
            priority={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#121218] text-5xl">✨</div>
        )}

        {!showLocalVideo && !useVideoElement && (
          <>
            <div
              className={cn('vh-video-face-mask pointer-events-none absolute inset-0 z-10', video.blinking && 'vh-video-blink')}
              aria-hidden
            />
            <div
              className="vh-video-eyes pointer-events-none absolute z-[11]"
              style={{ transform: `translate(${video.eyes.x}px, ${video.eyes.y}px)` }}
              aria-hidden
            >
              <span className="vh-vid-eye vh-vid-eye-l" />
              <span className="vh-vid-eye vh-vid-eye-r" />
            </div>
            <div
              className="vh-video-brows pointer-events-none absolute z-[11]"
              style={{ transform: `translateY(${video.expression.browOffset + video.brow * 12}px)` }}
              aria-hidden
            >
              <span className="vh-vid-brow vh-vid-brow-l" />
              <span className="vh-vid-brow vh-vid-brow-r" />
            </div>
            <div
              className={cn('vh-video-mouth pointer-events-none absolute z-[11]', `vh-phoneme-${video.phoneme}`)}
              style={{
                transform: `scaleY(${0.25 + video.jaw * 0.75}) scaleX(${0.85 + video.expression.mouthCurve * 0.2})`,
              }}
              aria-hidden
            />
            <div className="vh-video-shoulders pointer-events-none absolute bottom-0 left-0 right-0 z-[9] h-1/4 bg-gradient-to-t from-black/25 to-transparent" />
            {(video.pose === 'celebrating' || video.reaction === 'wave') && (
              <div className="vh-video-hand-wave pointer-events-none absolute z-[12]" aria-hidden />
            )}
          </>
        )}
      </div>
    </div>
  );
}