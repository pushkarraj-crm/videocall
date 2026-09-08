type CacheEntry = { prompt: string; at: number };

const MAX_ENTRIES = 200;
const TTL_MS = 15 * 60 * 1000;
const store = new Map<string, CacheEntry>();

export function promptCacheKey(hostId: string, userId: string, language: string): string {
  return `vh:prompt:${hostId}:${userId}:${language}`;
}

export function getCachedPrompt(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.prompt;
}

export function setCachedPrompt(key: string, prompt: string): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) store.delete(oldest[0]);
  }
  store.set(key, { prompt, at: Date.now() });
}

export function invalidatePromptCache(hostId: string, userId?: string): void {
  const prefix = userId ? `vh:prompt:${hostId}:${userId}` : `vh:prompt:${hostId}`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}