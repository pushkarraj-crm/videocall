'use client';

import { useEffect, useMemo, useState } from 'react';
import { VideoAvatar } from '@/components/calls/video-avatar';
import { AvatarAnimatedPortrait } from '@/components/calls/avatar-animated-portrait';
import { useVirtualHostAvatar } from '@/hooks/use-virtual-host-avatar';
import { resolveAssetHostSlug } from '@/lib/video-assets/asset-manager';
import type { VirtualHostMeta } from '@/types/api';

interface VirtualHostOverlayProps {
  virtualHost: VirtualHostMeta;
  connected: boolean;
  giftReaction?: {
    message?: string;
    animation?: string;
    expression?: string;
    category?: string;
    animationTier?: string;
  } | null;
  subtitle?: string | null;
  speaking?: boolean;
  thinking?: boolean;
  emotion?: string;
  callEvent?: string | null;
  lockedVideoUrl?: string | null;
}

export function VirtualHostOverlay({
  virtualHost,
  connected,
  giftReaction,
  subtitle,
  speaking = false,
  thinking = false,
  emotion = 'happy',
  callEvent,
  lockedVideoUrl,
}: VirtualHostOverlayProps) {
  const [lastCallEvent, setLastCallEvent] = useState<string | null>(null);

  const avatarSettings = useMemo(
    () => ({
      defaultIdleAnimation: virtualHost.avatar.defaultIdleAnimation,
      expressionIntensity: virtualHost.avatar.expressionIntensity,
      blinkFrequency: virtualHost.avatar.blinkFrequency,
      headMovement: virtualHost.avatar.headMovement,
      reactionsEnabled: virtualHost.avatar.reactionsEnabled,
      lipSyncIntensity: virtualHost.avatar.lipSyncIntensity,
      idleSchedulerEnabled: virtualHost.avatar.idleSchedulerEnabled,
      minAnimationCooldownMs: virtualHost.avatar.minAnimationCooldownMs,
    }),
    [virtualHost.avatar],
  );

  const videoSettings = useMemo(
    () => ({
      enabled: virtualHost.video?.enabled !== false,
      renderMode: virtualHost.video?.renderMode ?? 'cinematic',
      cameraMode: virtualHost.video?.cameraMode ?? 'auto',
      autoZoom: virtualHost.video?.autoZoom ?? true,
      dynamicFraming: virtualHost.video?.dynamicFraming ?? true,
      lipSyncMode: virtualHost.video?.lipSyncMode ?? 'phoneme',
      idleDrift: virtualHost.video?.idleDrift ?? true,
      eyeTracking: virtualHost.video?.eyeTracking ?? true,
    }),
    [virtualHost.video],
  );

  useEffect(() => {
    if (callEvent) setLastCallEvent(callEvent);
  }, [callEvent]);

  const { state } = useVirtualHostAvatar({
    settings: avatarSettings,
    emotion,
    speaking,
    thinking,
    connected,
    callEvent: lastCallEvent,
    giftCategory: giftReaction?.category ?? null,
    giftTier: giftReaction?.animationTier ?? null,
    reactionsEnabled: virtualHost.avatar.reactionsEnabled !== false,
  });

  const imageUrl = virtualHost.avatar.imageUrl;
  const useVideo = videoSettings.enabled;
  const activeOutfit = virtualHost.activeOutfit ?? virtualHost.wardrobe?.outfits?.[0] ?? null;
  const assetSlug = resolveAssetHostSlug(
    null,
    virtualHost.displayName,
    (virtualHost.video as { assetSlug?: string } | undefined)?.assetSlug,
    lockedVideoUrl,
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#1a1020]/90 via-[#0F0F12]/95 to-[#0F0F12]">
      {useVideo ? (
        <VideoAvatar
          displayName={virtualHost.displayName}
          imageUrl={imageUrl}
          avatarState={state}
          settings={videoSettings}
          outfit={activeOutfit}
          emotion={emotion}
          speaking={speaking}
          thinking={thinking}
          subtitle={subtitle}
          clips={virtualHost.video?.clips}
          hostSlug={assetSlug}
          sceneSlug={(virtualHost.video as { sceneSlug?: string } | undefined)?.sceneSlug ?? 'bedroom'}
          callEvent={lastCallEvent}
          giftCategory={giftReaction?.category ?? null}
          giftTier={giftReaction?.animationTier ?? null}
          lockedVideoUrl={lockedVideoUrl}
        />
      ) : (
        <AvatarAnimatedPortrait imageUrl={imageUrl} displayName={virtualHost.displayName} state={state} />
      )}
    </div>
  );
}