export type VideoCameraMode = 'close' | 'medium' | 'portrait' | 'auto';
export type VideoAvatarPose = 'idle' | 'talking' | 'listening' | 'laughing' | 'thinking' | 'celebrating';
export type WardrobeCategory =
  | 'casual'
  | 'party'
  | 'business'
  | 'summer'
  | 'beach'
  | 'fashion'
  | 'evening';

export type PhonemeShape = 'rest' | 'aa' | 'ee' | 'oh' | 'mm' | 'ff' | 'th';

export type VirtualHostVideoConfig = {
  enabled?: boolean;
  renderMode?: 'cinematic' | 'video';
  cameraMode?: VideoCameraMode;
  autoZoom?: boolean;
  dynamicFraming?: boolean;
  lipSyncMode?: 'phoneme' | 'energy';
  activePose?: VideoAvatarPose;
  idleDrift?: boolean;
  eyeTracking?: boolean;
  clips?: Partial<Record<VideoAvatarPose, string>>;
};

export type WardrobeOutfit = {
  id: string;
  name: string;
  category: WardrobeCategory;
  imageUrl?: string;
  videoIdleUrl?: string;
  videoTalkUrl?: string;
  approved?: boolean;
};

export type VirtualHostWardrobeConfig = {
  activeOutfitId?: string;
  outfits?: WardrobeOutfit[];
};

export const WARDROBE_CATEGORIES: WardrobeCategory[] = [
  'casual',
  'party',
  'business',
  'summer',
  'beach',
  'fashion',
  'evening',
];

export const VIDEO_POSES: VideoAvatarPose[] = [
  'idle',
  'talking',
  'listening',
  'laughing',
  'thinking',
  'celebrating',
];

export const CAMERA_FRAMING: Record<
  VideoCameraMode,
  { scale: number; translateY: number; borderRadius: string }
> = {
  close: { scale: 1.18, translateY: 8, borderRadius: '1.25rem' },
  medium: { scale: 1, translateY: 0, borderRadius: '1rem' },
  portrait: { scale: 0.88, translateY: -12, borderRadius: '0.75rem' },
  auto: { scale: 1, translateY: 0, borderRadius: '1rem' },
};

export function defaultVideoAvatarConfig(): VirtualHostVideoConfig {
  return {
    enabled: true,
    renderMode: 'cinematic',
    cameraMode: 'medium',
    autoZoom: true,
    dynamicFraming: true,
    lipSyncMode: 'phoneme',
    activePose: 'idle',
    idleDrift: true,
    eyeTracking: true,
    clips: {},
  };
}

export function defaultWardrobeConfig(imageUrl?: string): VirtualHostWardrobeConfig {
  const id = 'outfit_casual_default';
  return {
    activeOutfitId: id,
    outfits: [
      {
        id,
        name: 'Casual Default',
        category: 'casual',
        imageUrl,
        approved: true,
      },
    ],
  };
}

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

export function phonemeFromEnergy(tick: number, jawOpen: number, textHint?: string): PhonemeShape {
  if (jawOpen < 0.2) return 'rest';
  const char = textHint?.[tick % (textHint.length || 1)]?.toLowerCase();
  if (char && 'aáàâ'.includes(char)) return 'aa';
  if (char && 'eéèêiíì'.includes(char)) return 'ee';
  if (char && 'oóòôuúù'.includes(char)) return 'oh';
  if (char && 'mnbp'.includes(char)) return 'mm';
  if (char && 'fv'.includes(char)) return 'ff';
  const cycle = tick % 5;
  if (cycle === 0) return 'aa';
  if (cycle === 1) return 'ee';
  if (cycle === 2) return 'oh';
  if (cycle === 3) return 'mm';
  return jawOpen > 0.45 ? 'aa' : 'ee';
}

export function cameraFraming(
  mode: VideoCameraMode,
  opts: { speaking?: boolean; celebrating?: boolean; autoZoom?: boolean },
) {
  let resolved = mode;
  if (mode === 'auto' && opts.autoZoom) {
    if (opts.celebrating) resolved = 'close';
    else if (opts.speaking) resolved = 'medium';
    else resolved = 'portrait';
  }
  const base = CAMERA_FRAMING[resolved];
  const zoomBoost = opts.celebrating ? 1.08 : opts.speaking ? 1.03 : 1;
  return {
    ...base,
    scale: base.scale * zoomBoost,
    mode: resolved,
  };
}

export function bodyLanguageForEmotion(emotion: string): {
  headTilt: number;
  handMotion: boolean;
  laugh: boolean;
} {
  switch (emotion.toLowerCase()) {
    case 'thinking':
      return { headTilt: -6, handMotion: false, laugh: false };
    case 'happy':
    case 'smile':
      return { headTilt: 3, handMotion: false, laugh: true };
    case 'excited':
    case 'laughing':
      return { headTilt: 0, handMotion: true, laugh: true };
    case 'flirty':
    case 'romantic':
      return { headTilt: 5, handMotion: false, laugh: false };
    default:
      return { headTilt: 0, handMotion: false, laugh: false };
  }
}

export function giftBodyLanguage(category?: string, tier?: string): VideoAvatarPose {
  if (tier === 'cinematic' || category === 'vip') return 'celebrating';
  if (category === 'luxury') return 'celebrating';
  if (category === 'premium') return 'talking';
  return 'idle';
}