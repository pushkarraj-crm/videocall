import { RiskLevel } from '@prisma/client';

export function scoreToRiskLevel(score: number): RiskLevel {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s <= 25) return RiskLevel.low;
  if (s <= 50) return RiskLevel.medium;
  if (s <= 75) return RiskLevel.high;
  return RiskLevel.critical;
}

export function mergeScores(scores: number[]): number {
  if (scores.length === 0) return 0;
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.min(100, Math.round(max * 0.7 + avg * 0.3));
}