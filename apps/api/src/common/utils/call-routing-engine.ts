import type { HostProfile } from '@prisma/client';
import { canReceiveCalls } from './host-status';
import { isAiHostRoutable, isVirtualHostProfile } from './virtual-host';

export type CallRoutingPreferences = {
  preferredLanguage?: string | null;
  preferredRegion?: string | null;
  callerLanguage?: string | null;
};

export type RealHostCandidate = {
  userId: string;
  displayName: string;
  primaryLanguage: string | null;
  virtualHostRegion: string | null;
  lastSeenAt: Date | null;
  score: number;
};

export type AiHostCandidate = {
  userId: string;
  displayName: string;
  assetSlug: string;
  sceneSlug: string;
  outfitSlug: string;
  score: number;
};

export function slugifyAssetHost(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').trim() || 'host';
}

export function isRealHostAvailable(
  profile: Pick<
    HostProfile,
    'profileType' | 'isOnline' | 'isBusy' | 'adminCallsDisabled' | 'virtualHostEnabled'
  >,
): boolean {
  if (profile.profileType !== 'REAL_HOST') return false;
  if (profile.adminCallsDisabled) return false;
  return canReceiveCalls(profile.isOnline, profile.isBusy);
}

export function scoreRealHost(
  profile: Pick<HostProfile, 'virtualHostRegion'> & {
    user: { primaryLanguage: string | null };
  },
  prefs: CallRoutingPreferences,
): number {
  let score = 0;
  const lang = profile.user.primaryLanguage?.toLowerCase();
  const callerLang = prefs.callerLanguage?.toLowerCase();
  const prefLang = prefs.preferredLanguage?.toLowerCase();

  if (callerLang && lang && lang.startsWith(callerLang.slice(0, 2))) score += 40;
  if (prefLang && lang && lang.startsWith(prefLang.slice(0, 2))) score += 20;

  const region = profile.virtualHostRegion?.toLowerCase();
  const prefRegion = prefs.preferredRegion?.toLowerCase();
  if (prefRegion && region && region === prefRegion) score += 25;

  return score;
}

export function scoreAiHost(
  profile: Pick<HostProfile, 'virtualHostRegion' | 'virtualHostLanguage' | 'virtualHostPriority'> & {
    user: { primaryLanguage: string | null };
  },
  prefs: CallRoutingPreferences,
): number {
  let score = profile.virtualHostPriority ?? 0;
  const lang = (profile.virtualHostLanguage ?? profile.user.primaryLanguage)?.toLowerCase();
  const callerLang = prefs.callerLanguage?.toLowerCase();
  const prefLang = prefs.preferredLanguage?.toLowerCase();

  if (callerLang && lang && lang.startsWith(callerLang.slice(0, 2))) score += 30;
  if (prefLang && lang && lang.startsWith(prefLang.slice(0, 2))) score += 15;

  const region = profile.virtualHostRegion?.toLowerCase();
  const prefRegion = prefs.preferredRegion?.toLowerCase();
  if (prefRegion && region && region === prefRegion) score += 20;

  return score;
}

export function pickBestRealHost<T extends RealHostCandidate>(candidates: T[]): T | null {
  if (!candidates.length) return null;
  const max = Math.max(...candidates.map((c) => c.score));
  const pool = candidates.filter((c) => c.score === max);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickAiHost<T extends AiHostCandidate>(
  candidates: T[],
  randomSelection: boolean,
): T | null {
  if (!candidates.length) return null;
  if (randomSelection) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return [...candidates].sort((a, b) => b.score - a.score)[0];
}

export function resolveAssetSlug(
  displayName: string,
  videoConfig?: { assetSlug?: string } | null,
): string {
  return videoConfig?.assetSlug?.trim() || slugifyAssetHost(displayName);
}

export function isAiHostProfile(
  profile: Pick<HostProfile, 'profileType' | 'virtualHostEnabled'>,
): boolean {
  return isVirtualHostProfile(profile);
}

export { isAiHostRoutable };