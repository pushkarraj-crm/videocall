export type AvatarBlinkFrequency = 'low' | 'medium' | 'high';
export type AvatarHeadMovement = 'subtle' | 'normal' | 'expressive';

export type AvatarAnimationConfig = {
  defaultIdleAnimation?: string;
  expressionIntensity?: number;
  blinkFrequency?: AvatarBlinkFrequency;
  headMovement?: AvatarHeadMovement;
  reactionsEnabled?: boolean;
  lipSyncIntensity?: number;
  idleSchedulerEnabled?: boolean;
  minAnimationCooldownMs?: number;
};

export type AvatarExpression = {
  id: string;
  label: string;
  headTiltDeg: number;
  eyeScale: number;
  browOffset: number;
  mouthCurve: number;
  brightness: number;
  lookDirection: 'center' | 'left' | 'right' | 'up';
};

export type AvatarReaction = {
  id: string;
  durationMs: number;
  zoom?: number;
  standUp?: boolean;
};

export type IdleAnimationDef = {
  id: string;
  weight: number;
  minCooldownMs: number;
  durationMs: number;
};

export const AVATAR_EMOTION_EXPRESSIONS: Record<string, AvatarExpression> = {
  happy: {
    id: 'happy',
    label: 'Happy',
    headTiltDeg: 2,
    eyeScale: 1,
    browOffset: -2,
    mouthCurve: 0.6,
    brightness: 1.04,
    lookDirection: 'center',
  },
  smile: {
    id: 'smile',
    label: 'Smile',
    headTiltDeg: 3,
    eyeScale: 0.95,
    browOffset: -1,
    mouthCurve: 0.5,
    brightness: 1.03,
    lookDirection: 'center',
  },
  excited: {
    id: 'excited',
    label: 'Excited',
    headTiltDeg: 0,
    eyeScale: 1.1,
    browOffset: -4,
    mouthCurve: 0.85,
    brightness: 1.08,
    lookDirection: 'center',
  },
  flirty: {
    id: 'flirty',
    label: 'Flirty',
    headTiltDeg: 6,
    eyeScale: 0.92,
    browOffset: -2,
    mouthCurve: 0.55,
    brightness: 1.05,
    lookDirection: 'center',
  },
  romantic: {
    id: 'flirty',
    label: 'Flirty',
    headTiltDeg: 5,
    eyeScale: 0.9,
    browOffset: -2,
    mouthCurve: 0.5,
    brightness: 1.04,
    lookDirection: 'center',
  },
  thinking: {
    id: 'thinking',
    label: 'Thinking',
    headTiltDeg: -4,
    eyeScale: 0.88,
    browOffset: 3,
    mouthCurve: 0.1,
    brightness: 0.98,
    lookDirection: 'up',
  },
  confused: {
    id: 'confused',
    label: 'Confused',
    headTiltDeg: 8,
    eyeScale: 1,
    browOffset: 4,
    mouthCurve: 0.15,
    brightness: 1,
    lookDirection: 'left',
  },
  surprised: {
    id: 'surprised',
    label: 'Surprised',
    headTiltDeg: 0,
    eyeScale: 1.15,
    browOffset: -6,
    mouthCurve: 0.7,
    brightness: 1.06,
    lookDirection: 'center',
  },
  sad: {
    id: 'sad',
    label: 'Sad',
    headTiltDeg: -3,
    eyeScale: 0.9,
    browOffset: 4,
    mouthCurve: -0.3,
    brightness: 0.94,
    lookDirection: 'down' as 'center',
  },
  shy: {
    id: 'smile',
    label: 'Smile',
    headTiltDeg: 4,
    eyeScale: 0.85,
    browOffset: 0,
    mouthCurve: 0.35,
    brightness: 1.02,
    lookDirection: 'left',
  },
  laughing: {
    id: 'excited',
    label: 'Excited',
    headTiltDeg: 2,
    eyeScale: 0.8,
    browOffset: -3,
    mouthCurve: 0.9,
    brightness: 1.07,
    lookDirection: 'center',
  },
  sleepy: {
    id: 'sad',
    label: 'Soft',
    headTiltDeg: 5,
    eyeScale: 0.7,
    browOffset: 2,
    mouthCurve: 0.1,
    brightness: 0.96,
    lookDirection: 'center',
  },
};

export const GIFT_CATEGORY_REACTIONS: Record<string, AvatarReaction> = {
  basic: { id: 'smile', durationMs: 1800 },
  premium: { id: 'wave', durationMs: 2200 },
  luxury: { id: 'heart', durationMs: 2800 },
  vip: { id: 'celebrate_stand', durationMs: 3500, zoom: 1.15, standUp: true },
};

export const CALL_EVENT_REACTIONS: Record<string, AvatarReaction> = {
  user_joined: { id: 'smile', durationMs: 2000 },
  greeting: { id: 'smile', durationMs: 2000 },
  long_silence: { id: 'look_around', durationMs: 3000 },
  typing: { id: 'attention', durationMs: 1500 },
  user_typing: { id: 'attention', durationMs: 1500 },
  recharge: { id: 'celebrate', durationMs: 2500 },
  recharge_success: { id: 'celebrate', durationMs: 2500 },
  call_ending: { id: 'wave_goodbye', durationMs: 2800 },
  gift_received: { id: 'gift_smile', durationMs: 2200 },
};

export const IDLE_ANIMATION_CATALOG: IdleAnimationDef[] = [
  { id: 'breathe', weight: 20, minCooldownMs: 0, durationMs: 3200 },
  { id: 'blink', weight: 22, minCooldownMs: 2200, durationMs: 280 },
  { id: 'head_tilt_left', weight: 12, minCooldownMs: 4500, durationMs: 1800 },
  { id: 'head_tilt_right', weight: 12, minCooldownMs: 4500, durationMs: 1800 },
  { id: 'look_left', weight: 10, minCooldownMs: 5000, durationMs: 1600 },
  { id: 'look_right', weight: 10, minCooldownMs: 5000, durationMs: 1600 },
  { id: 'smile_shift', weight: 14, minCooldownMs: 6000, durationMs: 2000 },
  { id: 'shoulder_shift', weight: 10, minCooldownMs: 5000, durationMs: 1700 },
  { id: 'hair_sway', weight: 8, minCooldownMs: 7000, durationMs: 2200 },
  { id: 'eye_dart', weight: 10, minCooldownMs: 4000, durationMs: 900 },
];

export const BLINK_INTERVAL_MS: Record<AvatarBlinkFrequency, [number, number]> = {
  low: [5000, 9000],
  medium: [3200, 6000],
  high: [2000, 4200],
};

export function defaultAvatarAnimationConfig(): AvatarAnimationConfig {
  return {
    defaultIdleAnimation: 'breathe',
    expressionIntensity: 0.7,
    blinkFrequency: 'medium',
    headMovement: 'normal',
    reactionsEnabled: true,
    lipSyncIntensity: 0.75,
    idleSchedulerEnabled: true,
    minAnimationCooldownMs: 2800,
  };
}

export function mapEmotionToExpression(
  emotion: string,
  intensity = 0.7,
): AvatarExpression {
  const base = AVATAR_EMOTION_EXPRESSIONS[emotion.toLowerCase()] ?? AVATAR_EMOTION_EXPRESSIONS.happy;
  const scale = Math.max(0.2, Math.min(1, intensity));
  return {
    ...base,
    headTiltDeg: base.headTiltDeg * scale,
    browOffset: base.browOffset * scale,
    mouthCurve: base.mouthCurve * scale,
    brightness: 1 + (base.brightness - 1) * scale,
  };
}

export function mapGiftToReaction(
  category?: string,
  animationTier?: string,
): AvatarReaction {
  if (animationTier === 'cinematic' || category === 'vip') {
    return GIFT_CATEGORY_REACTIONS.vip;
  }
  if (animationTier === 'fullscreen' || category === 'luxury') {
    return GIFT_CATEGORY_REACTIONS.luxury;
  }
  if (animationTier === 'center' || category === 'premium') {
    return GIFT_CATEGORY_REACTIONS.premium;
  }
  return GIFT_CATEGORY_REACTIONS[category ?? 'basic'] ?? GIFT_CATEGORY_REACTIONS.basic;
}

export function mapCallEventToReaction(eventType: string): AvatarReaction | null {
  return CALL_EVENT_REACTIONS[eventType] ?? null;
}

export function pickIdleAnimation(
  config: AvatarAnimationConfig,
  lastPick: string | null,
  lastPlayedAt: Record<string, number>,
  now: number,
): IdleAnimationDef {
  const minCooldown = config.minAnimationCooldownMs ?? 2800;
  const eligible = IDLE_ANIMATION_CATALOG.filter((anim) => {
    if (anim.id === lastPick) return false;
    const lastAt = lastPlayedAt[anim.id] ?? 0;
    const cooldown = Math.max(anim.minCooldownMs, minCooldown);
    return now - lastAt >= cooldown;
  });

  const pool = eligible.length > 0 ? eligible : IDLE_ANIMATION_CATALOG.filter((a) => a.id === 'breathe');
  const totalWeight = pool.reduce((sum, a) => sum + a.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const anim of pool) {
    roll -= anim.weight;
    if (roll <= 0) return anim;
  }

  return pool[0] ?? IDLE_ANIMATION_CATALOG[0];
}

export function randomBlinkDelay(frequency: AvatarBlinkFrequency = 'medium'): number {
  const [min, max] = BLINK_INTERVAL_MS[frequency];
  return min + Math.floor(Math.random() * (max - min));
}

export function speakingMotionFrame(
  energy: number,
  tick: number,
  lipSyncIntensity = 0.75,
): { jawOpen: number; browPulse: number; headBob: number } {
  const e = Math.max(0.15, Math.min(1, energy * lipSyncIntensity));
  const wave = Math.sin(tick * 0.35) * 0.5 + Math.sin(tick * 0.71) * 0.3;
  return {
    jawOpen: 0.15 + Math.abs(wave) * e * 0.55,
    browPulse: Math.sin(tick * 0.2) * e * 0.08,
    headBob: Math.sin(tick * 0.25) * e * 0.04,
  };
}

export function headMovementScale(level: AvatarHeadMovement = 'normal'): number {
  switch (level) {
    case 'subtle':
      return 0.55;
    case 'expressive':
      return 1.35;
    default:
      return 1;
  }
}