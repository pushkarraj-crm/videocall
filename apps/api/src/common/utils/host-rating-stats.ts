import { CallHistoryStatus, KycVerificationStatus } from '@prisma/client';

export function averageRating(ratingSum: number, ratingCount: number): number | null {
  if (ratingCount <= 0) return null;
  return Math.round((ratingSum / ratingCount) * 10) / 10;
}

export function starDistribution(
  rows: Array<{ rating: number; _count: number }>,
): Record<1 | 2 | 3 | 4 | 5, number> {
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) {
    if (row.rating >= 1 && row.rating <= 5) {
      dist[row.rating as 1 | 2 | 3 | 4 | 5] = row._count;
    }
  }
  return dist;
}

export function positiveNegativePercent(
  distribution: Record<1 | 2 | 3 | 4 | 5, number>,
  total: number,
): { positivePercent: number; negativePercent: number } {
  if (total <= 0) return { positivePercent: 0, negativePercent: 0 };
  const positive = distribution[4] + distribution[5];
  const negative = distribution[1] + distribution[2];
  return {
    positivePercent: Math.round((positive / total) * 100),
    negativePercent: Math.round((negative / total) * 100),
  };
}

export function computeResponseRate(
  completed: number,
  missed: number,
  rejected: number,
): number | null {
  const total = completed + missed + rejected;
  if (total <= 0) return null;
  return Math.round((completed / total) * 100);
}

export function computeAvgResponseTimeSeconds(
  rows: Array<{ createdAt: Date; answeredAt: Date | null }>,
): number | null {
  const deltas: number[] = [];
  for (const row of rows) {
    if (!row.answeredAt) continue;
    const ms = row.answeredAt.getTime() - row.createdAt.getTime();
    if (ms >= 0) deltas.push(ms / 1000);
  }
  if (deltas.length === 0) return null;
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

export const COMPLETED_HISTORY_STATUS = CallHistoryStatus.completed;

export function isKycVerifiedStatus(status: KycVerificationStatus): boolean {
  return status === KycVerificationStatus.verified;
}