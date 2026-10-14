export type VideoCameraMode = 'close' | 'medium' | 'portrait' | 'auto';
export type VideoAvatarPose = 'idle' | 'talking' | 'listening' | 'laughing' | 'thinking' | 'celebrating';
export type PhonemeShape = 'rest' | 'aa' | 'ee' | 'oh' | 'mm' | 'ff' | 'th';

export type VideoAvatarSettings = {
  enabled?: boolean;
  renderMode?: 'cinematic' | 'video';
  cameraMode?: VideoCameraMode;
  autoZoom?: boolean;
  dynamicFraming?: boolean;
  lipSyncMode?: 'phoneme' | 'energy';
  idleDrift?: boolean;
  eyeTracking?: boolean;
};

export type WardrobeOutfit = {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  videoIdleUrl?: string;
  videoTalkUrl?: string;
  approved?: boolean;
};

const CAMERA = {
  close: { scale: 1.18, translateY: 8 },
  medium: { scale: 1, translateY: 0 },
  portrait: { scale: 0.88, translateY: -12 },
  auto: { scale: 1, translateY: 0 },
} as const;

export function resolvePose(
  speaking: boolean,
  thinking: boolean,
  reaction: string | null,
  emotion: string,
): VideoAvatarPose {
  if (reaction === 'celebrate' || reaction === 'celebrate_stand' || reaction === 'heart') {
    return 'celebrating';
  }
  if (reaction === 'wave' || reaction === 'wave_goodbye') return 'celebrating';
  if (speaking) return 'talking';
  if (thinking || emotion === 'thinking') return 'thinking';
  if (emotion === 'laughing' || emotion === 'excited') return 'laughing';
  return 'idle';
}

export function phonemeShape(
  tick: number,
  jaw: number,
  mode: 'phoneme' | 'energy',
  textHint?: string,
): PhonemeShape {
  if (jaw < 0.18) return 'rest';
  if (mode === 'energy') return jaw > 0.45 ? 'aa' : 'ee';
  const ch = textHint?.[tick % Math.max(1, textHint.length)]?.toLowerCase();
  if (ch && 'aáàâ'.includes(ch)) return 'aa';
  if (ch && 'eéèêiíì'.includes(ch)) return 'ee';
  if (ch && 'oóòôuúù'.includes(ch)) return 'oh';
  if (ch && 'mnbp'.includes(ch)) return 'mm';
  if (ch && 'fv'.includes(ch)) return 'ff';
  const c = tick % 5;
  if (c === 0) return 'aa';
  if (c === 1) return 'ee';
  if (c === 2) return 'oh';
  if (c === 3) return 'mm';
  return 'ee';
}

export function cameraFrame(
  mode: VideoCameraMode,
  opts: { speaking?: boolean; celebrating?: boolean; autoZoom?: boolean },
) {
  let m = mode;
  if (mode === 'auto' && opts.autoZoom) {
    if (opts.celebrating) m = 'close';
    else if (opts.speaking) m = 'medium';
    else m = 'portrait';
  }
  const base = CAMERA[m];
  const boost = opts.celebrating ? 1.08 : opts.speaking ? 1.03 : 1;
  return { mode: m, scale: base.scale * boost, translateY: base.translateY };
}

export function eyeLook(
  tick: number,
  tracking: boolean,
  lookX: number,
  lookY: number,
): { x: number; y: number } {
  if (!tracking) return { x: lookX, y: lookY };
  const drift = Math.sin(tick * 0.02) * 4;
  return { x: lookX + drift, y: lookY + Math.cos(tick * 0.015) * 2 };
}