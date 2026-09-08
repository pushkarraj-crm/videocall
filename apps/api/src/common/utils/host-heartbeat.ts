/** Host must ping every 20s; two missed beats → treated as offline. */
export const HOST_HEARTBEAT_INTERVAL_MS = 20_000;
export const HOST_HEARTBEAT_STALE_MS = 40_000;

export function isHeartbeatFresh(lastBeatAt: Date | null | undefined, now = new Date()): boolean {
  if (!lastBeatAt) return false;
  return now.getTime() - lastBeatAt.getTime() <= HOST_HEARTBEAT_STALE_MS;
}

export function heartbeatStaleCutoff(now = new Date()): Date {
  return new Date(now.getTime() - HOST_HEARTBEAT_STALE_MS);
}