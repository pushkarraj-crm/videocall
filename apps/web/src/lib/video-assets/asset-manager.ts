import {
  type AssetClip,
  type AssetType,
  type HostAssetCatalog,
  EXPECTED_ASSET_TYPES,
} from './asset-types';

export type AssetSelectionContext = {
  host: string;
  outfit?: string;
  scene?: string;
  emotion?: string;
  speaking?: boolean;
  thinking?: boolean;
  callEvent?: string | null;
  giftCategory?: string | null;
  giftTier?: string | null;
};

type PlayHistory = {
  lastClip: string | null;
  playedAt: Record<string, number>;
};

export const ASSET_COOLDOWN_MS = 12_000;
export const VIDEO_CROSSFADE_MS = 320;
export const VIDEO_RETURN_TO_IDLE_MS = 2_800;
const catalogCache: { manifest: HostAssetCatalog | null; fetchedAt: number } = {
  manifest: null,
  fetchedAt: 0,
};
const CACHE_TTL_MS = 60_000;

export function slugifyHost(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').trim() || 'host';
}

export function emotionToAssetType(ctx: AssetSelectionContext): AssetType {
  if (ctx.callEvent === 'call_ending') return 'bye';
  if (ctx.callEvent === 'user_joined' || ctx.callEvent === 'greeting') return 'welcome';
  if (ctx.giftTier === 'cinematic' || ctx.giftCategory === 'vip') return 'gift_vip';
  if (ctx.giftCategory === 'luxury' || ctx.giftCategory === 'premium') return 'gift_vip';
  if (ctx.giftCategory) return 'gift_small';
  if (ctx.callEvent === 'gift_received') return 'gift_small';
  if (ctx.speaking) return 'talking';
  if (ctx.thinking) return 'thinking';

  const em = (ctx.emotion ?? 'happy').toLowerCase();
  if (em === 'thinking') return 'thinking';
  if (em === 'laughing' || em === 'excited') return 'laugh';
  if (em === 'surprised') return 'surprised';
  if (em === 'happy' || em === 'smile' || em === 'flirty' || em === 'romantic' || em === 'shy') {
    return 'smile';
  }
  return 'idle';
}

export function shouldLoop(type: AssetType): boolean {
  return type === 'idle' || type === 'listening';
}

export function resolveSceneClips(
  catalog: HostAssetCatalog,
  host: string,
  outfit?: string,
  scene?: string,
): AssetClip[] {
  const hostNode = catalog.hosts[host];
  if (!hostNode) return [];

  const outfitKey = outfit && hostNode.outfits[outfit] ? outfit : Object.keys(hostNode.outfits)[0];
  if (!outfitKey) return [];

  const outfitNode = hostNode.outfits[outfitKey];
  const sceneKey = scene && outfitNode.scenes[scene] ? scene : Object.keys(outfitNode.scenes)[0];
  if (!sceneKey) return [];

  return outfitNode.scenes[sceneKey] ?? [];
}

export function pickClip(
  clips: AssetClip[],
  type: AssetType,
  history: PlayHistory,
  now = Date.now(),
): AssetClip | null {
  const pool = clips.filter((c) => c.type === type);
  const fallbackPool = type !== 'idle' ? clips.filter((c) => c.type === 'idle') : pool;
  const candidates = pool.length ? pool : fallbackPool;
  if (!candidates.length) return null;

  const eligible = candidates.filter((c) => {
    if (c.url === history.lastClip) return false;
    const last = history.playedAt[c.url] ?? 0;
    return now - last >= ASSET_COOLDOWN_MS;
  });

  const pickFrom = eligible.length ? eligible : candidates;
  const totalWeight = pickFrom.reduce((s, c) => s + (c.weight ?? 1), 0);
  let roll = Math.random() * totalWeight;

  for (const clip of pickFrom) {
    roll -= clip.weight ?? 1;
    if (roll <= 0) return clip;
  }
  return pickFrom[0];
}

export function selectAsset(
  catalog: HostAssetCatalog,
  ctx: AssetSelectionContext,
  history: PlayHistory,
): { clip: AssetClip | null; type: AssetType; fallback: boolean } {
  const type = emotionToAssetType(ctx);
  const clips = resolveSceneClips(catalog, ctx.host, ctx.outfit, ctx.scene);
  const clip = pickClip(clips, type, history);
  const fallback = clip ? clip.type !== type : true;
  return { clip, type, fallback };
}

export function predictNextTypes(ctx: AssetSelectionContext): AssetType[] {
  const primary = emotionToAssetType(ctx);
  const next: AssetType[] = [primary];
  if (primary === 'talking') next.push('idle');
  if (primary !== 'idle') next.push('idle');
  return [...new Set(next)];
}

export function listMissingAssets(catalog: HostAssetCatalog, host: string, outfit: string, scene: string) {
  const clips = resolveSceneClips(catalog, host, outfit, scene);
  const present = new Set(clips.map((c) => c.type));
  return EXPECTED_ASSET_TYPES.filter((t) => !present.has(t));
}

export async function loadAssetCatalog(force = false): Promise<HostAssetCatalog> {
  const now = Date.now();
  if (!force && catalogCache.manifest && now - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache.manifest;
  }
  try {
    const res = await fetch('/ai-hosts/manifest.json', { cache: force ? 'no-store' : 'default' });
    if (!res.ok) throw new Error('manifest missing');
    const manifest = (await res.json()) as HostAssetCatalog;
    catalogCache.manifest = manifest;
    catalogCache.fetchedAt = now;
    return manifest;
  } catch {
    return { hosts: {}, scannedAt: '', totalClips: 0 };
  }
}

export function invalidateCatalogCache() {
  catalogCache.manifest = null;
  catalogCache.fetchedAt = 0;
}

export function hostHasAssets(catalog: HostAssetCatalog, host: string): boolean {
  return Boolean(catalog.hosts[host]?.outfits && Object.keys(catalog.hosts[host].outfits).length > 0);
}

export function extractHostSlugFromUrl(url: string): string | null {
  const match = url.match(/\/ai-hosts\/([^/]+)\//);
  return match?.[1] ?? null;
}

/** Resolve which on-disk host folder to use for local MP4 assets. */
export function resolveAssetHostSlug(
  catalog: HostAssetCatalog | null,
  displayName: string,
  hostSlug?: string,
  lockedVideoUrl?: string | null,
): string {
  const candidates = [
    hostSlug?.trim(),
    lockedVideoUrl ? extractHostSlugFromUrl(lockedVideoUrl) : null,
    slugifyHost(displayName),
  ].filter((s): s is string => Boolean(s));

  if (catalog) {
    for (const slug of candidates) {
      if (hostHasAssets(catalog, slug)) return slug;
    }
    const first = Object.keys(catalog.hosts).find((h) => hostHasAssets(catalog, h));
    if (first) return first;
  }

  return candidates[0] ?? slugifyHost(displayName);
}

export function pickRandomIdleClip(
  catalog: HostAssetCatalog,
  host: string,
  outfit = 'casual',
  scene = 'bedroom',
): AssetClip | null {
  const clips = resolveSceneClips(catalog, host, outfit, scene);
  const idleClips = clips.filter((c) => c.type === 'idle');
  const pool = idleClips.length ? idleClips : clips;
  return pickClip(pool, 'idle', { lastClip: null, playedAt: {} });
}

export function catalogHasAssets(catalog: HostAssetCatalog | null): boolean {
  if (!catalog) return false;
  return Object.keys(catalog.hosts).some((h) => hostHasAssets(catalog, h));
}