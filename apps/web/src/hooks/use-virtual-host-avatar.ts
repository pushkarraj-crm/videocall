'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  callEventToReaction,
  defaultAvatarSettings,
  giftCategoryToReaction,
  headScale,
  pickIdleAnim,
  randomBlinkMs,
  reactionDuration,
  resolveExpression,
  speakingFrame,
  type AvatarAnimationSettings,
  type AvatarReactionKind,
} from '@/lib/avatar/avatar-animation-engine';

export type AvatarAnimState = {
  mode: 'idle' | 'speaking' | 'thinking' | 'reaction';
  idleAnim: string;
  reaction: AvatarReactionKind | null;
  expression: ReturnType<typeof resolveExpression>;
  speaking: { jaw: number; brow: number; bob: number };
  blinking: boolean;
  zoom: number;
  standUp: boolean;
};

export function useVirtualHostAvatar(params: {
  settings?: Partial<AvatarAnimationSettings>;
  emotion?: string;
  speaking?: boolean;
  thinking?: boolean;
  connected?: boolean;
  callEvent?: string | null;
  giftCategory?: string | null;
  giftTier?: string | null;
  reactionsEnabled?: boolean;
}) {
  const {
    settings: settingsOverride,
    emotion = 'happy',
    speaking = false,
    thinking = false,
    connected = true,
    callEvent,
    giftCategory,
    giftTier,
    reactionsEnabled = true,
  } = params;

  const settings = useMemo(
    () => ({ ...defaultAvatarSettings(), ...settingsOverride }),
    [settingsOverride],
  );

  const [idleAnim, setIdleAnim] = useState(settings.defaultIdleAnimation ?? 'breathe');
  const [reaction, setReaction] = useState<AvatarReactionKind | null>(null);
  const [blinking, setBlinking] = useState(false);
  const [speakTick, setSpeakTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [standUp, setStandUp] = useState(false);

  const lastIdleRef = useRef<string | null>(null);
  const playedAtRef = useRef<Record<string, number>>({});
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakRafRef = useRef<number | null>(null);

  const expression = useMemo(
    () => resolveExpression(emotion, settings.expressionIntensity ?? 0.7),
    [emotion, settings.expressionIntensity],
  );

  const triggerReaction = useCallback(
    (kind: AvatarReactionKind, opts?: { zoom?: number; standUp?: boolean }) => {
      if (!reactionsEnabled || settings.reactionsEnabled === false) return;
      setReaction(kind);
      setZoom(opts?.zoom ?? (kind === 'celebrate_stand' ? 1.12 : 1));
      setStandUp(opts?.standUp ?? kind === 'celebrate_stand');
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = setTimeout(() => {
        setReaction(null);
        setZoom(1);
        setStandUp(false);
      }, reactionDuration(kind));
    },
    [reactionsEnabled, settings.reactionsEnabled],
  );

  useEffect(() => {
    if (!callEvent) return;
    const kind = callEventToReaction(callEvent);
    if (kind) triggerReaction(kind);
  }, [callEvent, triggerReaction]);

  useEffect(() => {
    if (!giftCategory && !giftTier) return;
    const kind = giftCategoryToReaction(giftCategory ?? undefined, giftTier ?? undefined);
    triggerReaction(kind, {
      zoom: kind === 'celebrate_stand' ? 1.15 : 1,
      standUp: kind === 'celebrate_stand',
    });
  }, [giftCategory, giftTier, triggerReaction]);

  useEffect(() => {
    if (speaking) {
      let tick = 0;
      const loop = () => {
        tick++;
        setSpeakTick(tick);
        speakRafRef.current = requestAnimationFrame(loop);
      };
      speakRafRef.current = requestAnimationFrame(loop);
      return () => {
        if (speakRafRef.current) cancelAnimationFrame(speakRafRef.current);
      };
    }
    setSpeakTick(0);
    return undefined;
  }, [speaking]);

  useEffect(() => {
    const scheduleBlink = () => {
      blinkTimerRef.current = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 220);
      }, randomBlinkMs(settings.blinkFrequency));
    };
    scheduleBlink();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [settings.blinkFrequency]);

  useEffect(() => {
    if (speaking || thinking || reaction || !connected) return;

    const scheduleIdle = () => {
      const now = Date.now();
      const pick = pickIdleAnim(settings, lastIdleRef.current, playedAtRef.current, now);
      lastIdleRef.current = pick.id;
      playedAtRef.current[pick.id] = now;
      setIdleAnim(pick.id);
      idleTimerRef.current = setTimeout(scheduleIdle, pick.durationMs);
    };

    scheduleIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [connected, speaking, thinking, reaction, settings]);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      if (speakRafRef.current) cancelAnimationFrame(speakRafRef.current);
    };
  }, []);

  const hScale = headScale(settings.headMovement);
  const speakMotion = speaking
    ? speakingFrame(speakTick, 0.85, settings.lipSyncIntensity)
    : { jaw: 0, brow: 0, bob: 0 };

  const mode: AvatarAnimState['mode'] = reaction
    ? 'reaction'
    : speaking
      ? 'speaking'
      : thinking
        ? 'thinking'
        : 'idle';

  const state: AvatarAnimState = {
    mode,
    idleAnim,
    reaction,
    expression: {
      ...expression,
      headTiltDeg: expression.headTiltDeg * hScale,
      lookX: expression.lookX * hScale,
      lookY: expression.lookY * hScale,
    },
    speaking: speakMotion,
    blinking,
    zoom,
    standUp,
  };

  return { state, triggerReaction };
}