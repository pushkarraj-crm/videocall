export const RELATIONSHIP_TIERS = [
  { min: 0, label: 'First Call', emoji: '👋' },
  { min: 20, label: 'Friend', emoji: '🙂' },
  { min: 50, label: 'Close Friend', emoji: '💛' },
  { min: 100, label: 'Favorite Person', emoji: '❤️' },
  { min: 200, label: 'VIP Friend', emoji: '⭐' },
  { min: 500, label: 'Best Friend', emoji: '💎' },
] as const;

export type RelationshipTier = {
  min: number;
  label: string;
  emoji: string;
};

export type RelationshipEvent =
  | 'message'
  | 'long_conversation'
  | 'gift'
  | 'recharge'
  | 'daily_call'
  | 'positive'
  | 'inactivity'
  | 'abusive'
  | 'ignored_call';

export function getRelationshipTier(score: number): RelationshipTier {
  let tier: RelationshipTier = RELATIONSHIP_TIERS[0];
  for (const t of RELATIONSHIP_TIERS) {
    if (score >= t.min) tier = t;
  }
  return tier;
}

export function relationshipScoreDelta(event: RelationshipEvent, ctx?: {
  messageLength?: number;
  callDurationSeconds?: number;
  daysSinceLastCall?: number;
}): number {
  switch (event) {
    case 'message':
      return ctx?.messageLength && ctx.messageLength > 40 ? 2 : 1;
    case 'long_conversation':
      return (ctx?.callDurationSeconds ?? 0) >= 300 ? 8 : 3;
    case 'gift':
      return 12;
    case 'recharge':
      return 10;
    case 'daily_call':
      return 6;
    case 'positive':
      return 4;
    case 'inactivity':
      return ctx?.daysSinceLastCall && ctx.daysSinceLastCall > 30 ? -15 : -5;
    case 'abusive':
      return -25;
    case 'ignored_call':
      return -8;
    default:
      return 0;
  }
}

export function clampRelationshipScore(score: number): number {
  return Math.max(0, Math.min(1000, score));
}

export function isDailyCallStreak(lastCall: Date | null | undefined, now = new Date()): boolean {
  if (!lastCall) return false;
  const diffHours = (now.getTime() - lastCall.getTime()) / (1000 * 60 * 60);
  return diffHours >= 20 && diffHours <= 48;
}

export function daysSince(date: Date | null | undefined, now = new Date()): number {
  if (!date) return 999;
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}