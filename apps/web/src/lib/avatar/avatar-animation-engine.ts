export type AvatarBlinkFrequency = 'low' | 'medium' | 'high';
export type AvatarHeadMovement = 'subtle' | 'normal' | 'expressive';

export type AvatarAnimationSettings = {
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
  headTiltDeg: number;
  eyeScale: number;
  browOffset: number;
  mouthCurve: number;
  brightness: number;
  lookX: number;
  lookY: number;
};

export type AvatarReactionKind =
  | 'smile'
  | 'wave'
  | 'heart'
  | 'celebrate_stand'
  | 'look_around'
  | 'attention'
  | 'celebrate'
  | 'wave_goodbye'
  | 'gift_smile';

export const EMOTION_MAP: Record<string, AvatarExpression> = {
  happy: { id: 'happy', headTiltDeg: 2, eyeScale: 1, browOffset: -2, mouthCurve: 0.6, brightness: 1.04, lookX: 0, lookY: 0 },
  smile: { id: 'smile', headTiltDeg: 3, eyeScale: 0.95, browOffset: -1, mouthCurve: 0.5, brightness: 1.03, lookX: 0, lookY: 0 },
  excited: { id: 'excited', headTiltDeg: 0, eyeScale: 1.1, browOffset: -4, mouthCurve: 0.85, brightness: 1.08, lookX: 0, lookY: 0 },
  flirty: { id: 'flirty', headTiltDeg: 6, eyeScale: 0.92, browOffset: -2, mouthCurve: 0.55, brightness: 1.05, lookX: 0, lookY: -2 },
  romantic: { id: 'flirty', headTiltDeg: 5, eyeScale: 0.9, browOffset: -2, mouthCurve: 0.5, brightness: 1.04, lookX: 0, lookY: -1 },
  thinking: { id: 'thinking', headTiltDeg: -4, eyeScale: 0.88, browOffset: 3, mouthCurve: 0.1, brightness: 0.98, lookX: 0, lookY: -8 },
  confused: { id: 'confused', headTiltDeg: 8, eyeScale: 1, browOffset: 4, mouthCurve: 0.15, brightness: 1, lookX: -6, lookY: 0 },
  surprised: { id: 'surprised', headTiltDeg: 0, eyeScale: 1.15, browOffset: -6, mouthCurve: 0.7, brightness: 1.06, lookX: 0, lookY: 0 },
  sad: { id: 'sad', headTiltDeg: -3, eyeScale: 0.9, browOffset: 4, mouthCurve: -0.3, brightness: 0.94, lookX: 0, lookY: 2 },
  shy: { id: 'smile', headTiltDeg: 4, eyeScale: 0.85, browOffset: 0, mouthCurve: 0.35, brightness: 1.02, lookX: -4, lookY: 0 },
  laughing: { id: 'excited', headTiltDeg: 2, eyeScale: 0.8, browOffset: -3, mouthCurve: 0.9, brightness: 1.07, lookX: 0, lookY: 0 },
  sleepy: { id: 'sad', headTiltDeg: 5, eyeScale: 0.7, browOffset: 2, mouthCurve: 0.1, brightness: 0.96, lookX: 0, lookY: 0 },
};

const IDLE_ANIMS = [
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
] as const;

const BLINK_MS: Record<AvatarBlinkFrequency, [number, number]> = {
  low: [5000, 9000],
  medium: [3200, 6000],
  high: [2000, 4200],
};

export function defaultAvatarSettings(): AvatarAnimationSettings {
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

export function resolveExpression(emotion: string, intensity = 0.7): AvatarExpression {
  const base = EMOTION_MAP[emotion.toLowerCase()] ?? EMOTION_MAP.happy;
  const s = Math.max(0.2, Math.min(1, intensity));
  return {
    ...base,
    headTiltDeg: base.headTiltDeg * s,
    browOffset: base.browOffset * s,
    mouthCurve: base.mouthCurve * s,
    brightness: 1 + (base.brightness - 1) * s,
    lookX: base.lookX * s,
    lookY: base.lookY * s,
  };
}

export function giftCategoryToReaction(category?: string, tier?: string): AvatarReactionKind {
  if (tier === 'cinematic' || category === 'vip') return 'celebrate_stand';
  if (tier === 'fullscreen' || category === 'luxury') return 'heart';
  if (tier === 'center' || category === 'premium') return 'wave';
  return 'smile';
}

export function callEventToReaction(event?: string): AvatarReactionKind | null {
  switch (event) {
    case 'greeting':
    case 'user_joined':
      return 'smile';
    case 'long_silence':
      return 'look_around';
    case 'typing':
    case 'user_typing':
      return 'attention';
    case 'recharge':
    case 'recharge_success':
      return 'celebrate';
    case 'call_ending':
      return 'wave_goodbye';
    case 'gift_received':
      return 'gift_smile';
    default:
      return null;
  }
}

export function pickIdleAnim(
  settings: AvatarAnimationSettings,
  lastId: string | null,
  playedAt: Record<string, number>,
  now: number,
) {
  if (!settings.idleSchedulerEnabled) {
    return { id: settings.defaultIdleAnimation ?? 'breathe', durationMs: 3200 };
  }
  const minCd = settings.minAnimationCooldownMs ?? 2800;
  const pool = IDLE_ANIMS.filter((a) => {
    if (a.id === lastId) return false;
    return now - (playedAt[a.id] ?? 0) >= Math.max(a.minCooldownMs, minCd);
  });
  const candidates = pool.length ? pool : IDLE_ANIMS.filter((a) => a.id === 'breathe');
  const total = candidates.reduce((s, a) => s + a.weight, 0);
  let roll = Math.random() * total;
  for (const a of candidates) {
    roll -= a.weight;
    if (roll <= 0) return a;
  }
  return candidates[0];
}

export function randomBlinkMs(freq: AvatarBlinkFrequency = 'medium') {
  const [min, max] = BLINK_MS[freq];
  return min + Math.floor(Math.random() * (max - min));
}

export function headScale(level: AvatarHeadMovement = 'normal') {
  if (level === 'subtle') return 0.55;
  if (level === 'expressive') return 1.35;
  return 1;
}

export function speakingFrame(tick: number, energy: number, lipSync = 0.75) {
  const e = Math.max(0.15, Math.min(1, energy * lipSync));
  const w = Math.sin(tick * 0.35) * 0.5 + Math.sin(tick * 0.71) * 0.3;
  return {
    jaw: 0.12 + Math.abs(w) * e * 0.5,
    brow: Math.sin(tick * 0.2) * e * 0.06,
    bob: Math.sin(tick * 0.25) * e * 0.035,
  };
}

export function reactionDuration(kind: AvatarReactionKind): number {
  switch (kind) {
    case 'celebrate_stand':
      return 3500;
    case 'heart':
      return 2800;
    case 'wave':
      return 2200;
    case 'look_around':
      return 3000;
    case 'wave_goodbye':
      return 2800;
    case 'celebrate':
      return 2500;
    default:
      return 1800;
  }
}