import type { HostProfile, HostProfileType, VirtualHostStatus } from '@prisma/client';

export const VIRTUAL_PROFILE_TYPES: HostProfileType[] = ['MANAGED_HOST', 'AI_HOST'];

export const VIRTUAL_PERSONALITIES = [
  'Cute',
  'Friendly',
  'Funny',
  'Romantic',
  'Gaming',
  'Study',
  'Fitness',
  'Luxury',
  'Elegant',
  'Soft Spoken',
  'Confident',
] as const;

export type VirtualPersonality = (typeof VIRTUAL_PERSONALITIES)[number];

export type VoiceProviderName = 'openai' | 'elevenlabs' | 'cartesia' | 'local';

export type VirtualHostVoiceConfig = {
  voiceProvider?: VoiceProviderName;
  provider?: string;
  voiceId?: string;
  language?: string;
  gender?: 'female' | 'male' | 'neutral';
  emotion?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  stability?: number;
  style?: string;
  personality?: string;
  streamingEnabled?: boolean;
};

export function resolveVoiceProvider(config: VirtualHostVoiceConfig): VoiceProviderName {
  const p = (config.voiceProvider ?? config.provider ?? 'local').toLowerCase();
  if (p === 'openai' || p === 'elevenlabs' || p === 'cartesia') return p;
  return 'local';
}

export function defaultVoiceConfig(language = 'en'): VirtualHostVoiceConfig {
  return {
    voiceProvider: 'local',
    voiceId: 'warm_female_1',
    language,
    gender: 'female',
    emotion: 'friendly',
    speed: 1,
    pitch: 1,
    volume: 1,
    stability: 0.5,
    style: 'soft',
    personality: 'Friendly',
    streamingEnabled: true,
  };
}

export type VirtualHostAvatarConfig = {
  imageUrl?: string;
  idleAnimation?: string;
  talkAnimation?: string;
  smileAnimation?: string;
  giftReactionAnimation?: string;
  callEndAnimation?: string;
  typingAnimation?: string;
  defaultIdleAnimation?: string;
  expressionIntensity?: number;
  blinkFrequency?: 'low' | 'medium' | 'high';
  headMovement?: 'subtle' | 'normal' | 'expressive';
  reactionsEnabled?: boolean;
  lipSyncIntensity?: number;
  idleSchedulerEnabled?: boolean;
  minAnimationCooldownMs?: number;
};

export type VirtualHostPersonalityConfig = {
  style?: VirtualPersonality | string;
  mood?: string;
  responseStyle?: string;
  greeting?: string;
  emojiUsage?: 'low' | 'medium' | 'high';
  speakingSpeed?: 'slow' | 'normal' | 'fast';
  flirtingLevel?: 'none' | 'light' | 'medium' | 'high';
  language?: string;
  customPersonality?: string;
};

export type VirtualHostGiftReaction = {
  animation?: string;
  message?: string;
  expression?: string;
};

export const DEFAULT_GIFT_REACTIONS: Record<string, VirtualHostGiftReaction> = {
  rose: { expression: 'smile', message: 'Thank you for the rose!', animation: 'smile' },
  heart: { expression: 'thank_you', message: 'Aww, thank you!', animation: 'heart_glow' },
  cake: { expression: 'happy', message: 'Yay, cake!', animation: 'celebrate' },
  ring: { expression: 'blush', message: 'So sweet of you!', animation: 'sparkle' },
  diamond: { expression: 'excited', message: 'Wow, a diamond!', animation: 'excited' },
  sports_car: { expression: 'excited', message: 'Vroom vroom!', animation: 'celebrate' },
  jet: { expression: 'premium', message: 'Flying high with you!', animation: 'rocket' },
  galaxy: { expression: 'cinematic', message: 'You are out of this world!', animation: 'cinematic' },
};

export function isVirtualProfileType(profileType: HostProfileType): boolean {
  return profileType === 'MANAGED_HOST' || profileType === 'AI_HOST';
}

export function isVirtualHostProfile(
  profile: Pick<HostProfile, 'profileType' | 'virtualHostEnabled'>,
): boolean {
  return isVirtualProfileType(profile.profileType) && profile.virtualHostEnabled;
}

export function virtualStatusToAvailability(status: VirtualHostStatus | null | undefined): {
  isOnline: boolean;
  isBusy: boolean;
  isAvailable: boolean;
} {
  switch (status) {
    case 'ONLINE':
      return { isOnline: true, isBusy: false, isAvailable: true };
    case 'BUSY':
      return { isOnline: true, isBusy: true, isAvailable: false };
    case 'OFFLINE':
    default:
      return { isOnline: false, isBusy: false, isAvailable: false };
  }
}

export function syncVirtualHostAvailability(
  status: VirtualHostStatus,
): Pick<HostProfile, 'isOnline' | 'isBusy' | 'isAvailable' | 'virtualHostStatus'> {
  const avail = virtualStatusToAvailability(status);
  return {
    virtualHostStatus: status,
    isOnline: avail.isOnline,
    isBusy: avail.isBusy,
    isAvailable: avail.isAvailable,
  };
}

export function isVirtualHostDiscoverable(
  profile: Pick<
    HostProfile,
    | 'profileType'
    | 'virtualHostEnabled'
    | 'virtualHostStatus'
    | 'adminCallsDisabled'
    | 'isOnline'
    | 'isBusy'
  >,
): boolean {
  if (!isVirtualHostProfile(profile)) return false;
  if (profile.adminCallsDisabled) return false;
  if (profile.virtualHostStatus === 'OFFLINE' || !profile.virtualHostStatus) return false;
  if (profile.virtualHostStatus === 'BUSY' || profile.isBusy) return false;
  return profile.isOnline && profile.virtualHostStatus === 'ONLINE';
}

export function canVirtualHostReceiveCall(
  profile: Pick<
    HostProfile,
    | 'profileType'
    | 'virtualHostEnabled'
    | 'virtualHostStatus'
    | 'adminCallsDisabled'
    | 'isBusy'
  >,
): boolean {
  if (!isVirtualHostProfile(profile)) return false;
  if (profile.adminCallsDisabled) return false;
  if (profile.isBusy || profile.virtualHostStatus === 'BUSY') return false;
  return profile.virtualHostStatus === 'ONLINE';
}

/** AI hosts are routable when enabled; per-host BUSY does not block routing. */
export function isAiHostRoutable(
  profile: Pick<
    HostProfile,
    'profileType' | 'virtualHostEnabled' | 'virtualHostStatus' | 'adminCallsDisabled'
  >,
): boolean {
  if (!isVirtualHostProfile(profile)) return false;
  if (profile.adminCallsDisabled) return false;
  return profile.virtualHostStatus !== 'OFFLINE';
}

export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  return fallback;
}

export function buildPersonalitySnapshot(
  profile: Pick<
    HostProfile,
    'virtualHostPersonality' | 'virtualHostVoice' | 'virtualHostLanguage' | 'virtualHostGreeting'
  >,
) {
  const personality = parseJsonField<VirtualHostPersonalityConfig>(
    profile.virtualHostPersonality,
    {},
  );
  const voice = parseJsonField<VirtualHostVoiceConfig>(profile.virtualHostVoice, {});
  return {
    personality,
    voice,
    language: profile.virtualHostLanguage ?? personality.language ?? voice.language ?? 'en',
    greeting: profile.virtualHostGreeting ?? personality.greeting ?? null,
  };
}

export function buildDiscoverSortScore(
  profile: Pick<HostProfile, 'virtualHostPriority' | 'virtualHostPopularity' | 'totalCalls' | 'ratingCount' | 'ratingSum'>,
): number {
  const rating = profile.ratingCount > 0 ? profile.ratingSum / profile.ratingCount : 0;
  return (
    profile.virtualHostPriority * 1000 +
    profile.virtualHostPopularity * 10 +
    profile.totalCalls * 2 +
    rating * 5
  );
}

export function generateSessionId(callId: string): string {
  return `vh_${callId.replace(/-/g, '').slice(0, 24)}`;
}

export function buildConversationSummary(params: {
  hostName: string;
  durationSeconds: number;
  giftsReceived: number;
  personality?: string;
  callCount: number;
}): string {
  const mins = Math.max(1, Math.round(params.durationSeconds / 60));
  const gifts =
    params.giftsReceived > 0
      ? ` Received ${params.giftsReceived} gift${params.giftsReceived === 1 ? '' : 's'}.`
      : '';
  const style = params.personality ? ` ${params.personality} vibe.` : '';
  return `${params.hostName} chatted for ${mins} min.${gifts}${style} Session #${params.callCount}.`;
}