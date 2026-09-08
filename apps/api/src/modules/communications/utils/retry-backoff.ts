const BASE_MS = 30_000;
const MAX_MS = 30 * 60_000;

export function computeRetryDelayMs(attempt: number): number {
  const exp = Math.min(BASE_MS * 2 ** Math.max(attempt - 1, 0), MAX_MS);
  const jitter = Math.floor(Math.random() * 0.2 * exp);
  return exp + jitter;
}

export function nextRetryAt(attempt: number, from = new Date()): Date {
  return new Date(from.getTime() + computeRetryDelayMs(attempt));
}