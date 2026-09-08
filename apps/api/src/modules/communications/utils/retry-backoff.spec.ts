import { computeRetryDelayMs, nextRetryAt } from './retry-backoff';

describe('retry-backoff', () => {
  it('computes exponential delay with cap', () => {
    expect(computeRetryDelayMs(1)).toBeGreaterThanOrEqual(30_000);
    expect(computeRetryDelayMs(10)).toBeLessThanOrEqual(30 * 60_000 + 6_000_000);
  });

  it('returns future retry timestamp', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const next = nextRetryAt(2, from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});