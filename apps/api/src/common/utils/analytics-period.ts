export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface AnalyticsDateRange {
  from: Date;
  to: Date;
  period: AnalyticsPeriod;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function resolveAnalyticsRange(
  period: AnalyticsPeriod = '30d',
  from?: string,
  to?: string,
): AnalyticsDateRange {
  const now = new Date();
  const rangeEnd = to ? endOfDay(new Date(to)) : endOfDay(now);

  if (period === 'custom' && from) {
    return {
      from: startOfDay(new Date(from)),
      to: rangeEnd,
      period,
    };
  }

  const rangeStart = startOfDay(rangeEnd);
  switch (period) {
    case 'today':
      break;
    case '7d':
      rangeStart.setDate(rangeStart.getDate() - 6);
      break;
    case '90d':
      rangeStart.setDate(rangeStart.getDate() - 89);
      break;
    case '30d':
    default:
      rangeStart.setDate(rangeStart.getDate() - 29);
      break;
  }

  return { from: rangeStart, to: rangeEnd, period };
}

export function unitsToInr(units: bigint | number | null | undefined): number {
  return Number(units ?? 0) / 100;
}

export function decimalToNumber(value: { toString(): string } | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

export function calcPlatformProfit(totalRevenueInr: number, hostWithdrawnInr: number): number {
  return Math.max(0, totalRevenueInr - hostWithdrawnInr);
}

export function calcAvgDurationSeconds(totalSeconds: number, callCount: number): number {
  if (callCount <= 0) return 0;
  return Math.round(totalSeconds / callCount);
}

export function calcRevenuePerCall(revenueInr: number, callCount: number): number {
  if (callCount <= 0) return 0;
  return Math.round((revenueInr / callCount) * 100) / 100;
}

export function buildDailyTrend<T extends { date: string }>(
  from: Date,
  to: Date,
  rows: T[],
  defaults: Omit<T, 'date'>,
): T[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const result: T[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);

  while (cursor <= end) {
    const key = formatDateKey(cursor);
    result.push(byDate.get(key) ?? ({ date: key, ...defaults } as T));
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}