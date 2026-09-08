import {
  averageRating,
  computeAvgResponseTimeSeconds,
  computeResponseRate,
  positiveNegativePercent,
  starDistribution,
} from './host-rating-stats';

describe('host-rating-stats', () => {
  it('computes average rating', () => {
    expect(averageRating(47, 10)).toBe(4.7);
    expect(averageRating(0, 0)).toBeNull();
  });

  it('builds star distribution', () => {
    const dist = starDistribution([
      { rating: 5, _count: 10 },
      { rating: 1, _count: 2 },
    ]);
    expect(dist[5]).toBe(10);
    expect(dist[1]).toBe(2);
    expect(dist[3]).toBe(0);
  });

  it('computes positive and negative percent', () => {
    const dist = { 1: 1, 2: 1, 3: 0, 4: 3, 5: 5 };
    expect(positiveNegativePercent(dist, 10)).toEqual({
      positivePercent: 80,
      negativePercent: 20,
    });
  });

  it('computes response rate', () => {
    expect(computeResponseRate(8, 1, 1)).toBe(80);
    expect(computeResponseRate(0, 0, 0)).toBeNull();
  });

  it('computes average response time', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const secs = computeAvgResponseTimeSeconds([
      { createdAt: base, answeredAt: new Date(base.getTime() + 10_000) },
      { createdAt: base, answeredAt: new Date(base.getTime() + 30_000) },
    ]);
    expect(secs).toBe(20);
  });
});