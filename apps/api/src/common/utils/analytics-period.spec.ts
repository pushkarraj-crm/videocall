import {
  buildDailyTrend,
  calcAvgDurationSeconds,
  calcPlatformProfit,
  calcRevenuePerCall,
  formatDateKey,
  resolveAnalyticsRange,
  unitsToInr,
} from './analytics-period';

describe('resolveAnalyticsRange', () => {
  it('resolves 7-day range ending today', () => {
    const { from, to, period } = resolveAnalyticsRange('7d');
    expect(period).toBe('7d');
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
    const days =
      Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    expect(days).toBeGreaterThanOrEqual(7);
    expect(days).toBeLessThanOrEqual(8);
  });

  it('resolves custom range', () => {
    const { from, to } = resolveAnalyticsRange('custom', '2026-06-01', '2026-06-10');
    expect(formatDateKey(from)).toBe('2026-06-01');
    expect(formatDateKey(to)).toBe('2026-06-10');
  });
});

describe('analytics calculations', () => {
  it('converts units to INR', () => {
    expect(unitsToInr(500n)).toBe(5);
  });

  it('calculates platform profit', () => {
    expect(calcPlatformProfit(10000, 3000)).toBe(7000);
    expect(calcPlatformProfit(1000, 2000)).toBe(0);
  });

  it('calculates average duration', () => {
    expect(calcAvgDurationSeconds(600, 10)).toBe(60);
    expect(calcAvgDurationSeconds(0, 0)).toBe(0);
  });

  it('calculates revenue per call', () => {
    expect(calcRevenuePerCall(100, 4)).toBe(25);
  });
});

describe('buildDailyTrend', () => {
  it('fills missing days with defaults', () => {
    const from = new Date(2026, 5, 1);
    const to = new Date(2026, 5, 3);
    const rows = buildDailyTrend(
      from,
      to,
      [{ date: '2026-06-02', revenueInr: 50, calls: 2 }],
      { revenueInr: 0, calls: 0 },
    );

    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.date === '2026-06-02')).toEqual({
      date: '2026-06-02',
      revenueInr: 50,
      calls: 2,
    });
    expect(rows[0].revenueInr).toBe(0);
  });
});