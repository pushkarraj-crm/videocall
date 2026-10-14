'use client';

import { useMemo } from 'react';
import type { AvatarAnimState } from '@/hooks/use-virtual-host-avatar';
import {
  cameraFrame,
  eyeLook,
  phonemeShape,
  resolvePose,
  type VideoAvatarSettings,
} from '@/lib/video-avatar/video-avatar-engine';

export function useVideoAvatar(params: {
  avatarState: AvatarAnimState;
  settings: VideoAvatarSettings;
  emotion: string;
  speaking: boolean;
  thinking: boolean;
  subtitle?: string | null;
  speakTick?: number;
}) {
  const { avatarState, settings, emotion, speaking, thinking, subtitle, speakTick = 0 } = params;

  const pose = useMemo(
    () => resolvePose(speaking, thinking, avatarState.reaction, emotion),
    [speaking, thinking, avatarState.reaction, emotion],
  );

  const celebrating = pose === 'celebrating' || avatarState.standUp;
  const frame = useMemo(
    () =>
      cameraFrame(settings.cameraMode ?? 'medium', {
        speaking,
        celebrating,
        autoZoom: settings.autoZoom,
      }),
    [settings.cameraMode, settings.autoZoom, speaking, celebrating],
  );

  const phoneme = phonemeShape(
    speakTick,
    avatarState.speaking.jaw,
    settings.lipSyncMode ?? 'phoneme',
    subtitle ?? undefined,
  );

  const eyes = eyeLook(
    speakTick,
    settings.eyeTracking !== false,
    avatarState.expression.lookX,
    avatarState.expression.lookY,
  );

  return {
    pose,
    frame,
    phoneme,
    eyes,
    jaw: avatarState.speaking.jaw,
    brow: avatarState.speaking.brow,
    bob: avatarState.speaking.bob,
    expression: avatarState.expression,
    blinking: avatarState.blinking,
    reaction: avatarState.reaction,
    idleAnim: avatarState.idleAnim,
    zoom: avatarState.zoom * frame.scale,
    translateY: frame.translateY,
    cameraMode: frame.mode,
  };
}