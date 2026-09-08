import { averageRating } from './host-rating-stats';
import {
  canReceiveCalls,
  formatLastSeenLabel,
  resolveHostStatus,
} from './host-status';

export const FOLLOW_USER_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

export type FollowHostProfile = {
  userId: string;
  isOnline: boolean;
  isBusy: boolean;
  lastSeenAt: Date | null;
  languages: unknown;
  totalCalls: number;
  ratingSum: number;
  ratingCount: number;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    gender: string | null;
    primaryLanguage: string;
  };
};

export function serializeFavoriteHost(
  host: FollowHostProfile,
  extras: {
    followerCount: number;
    isVerified: boolean;
    isFollowing: boolean;
    followedAt?: Date;
  },
) {
  const status = resolveHostStatus(host.isOnline, host.isBusy);
  const receivable = canReceiveCalls(host.isOnline, host.isBusy);
  return {
    userId: host.userId,
    isAvailable: receivable,
    isOnline: host.isOnline,
    isBusy: host.isBusy,
    status,
    lastSeenAt: host.lastSeenAt,
    lastSeenLabel: formatLastSeenLabel(host.lastSeenAt, host.isOnline, host.isBusy),
    canReceiveCalls: receivable,
    totalCalls: host.totalCalls,
    rating: host.ratingCount > 0 ? host.ratingSum / host.ratingCount : null,
    reviewCount: host.ratingCount,
    followerCount: extras.followerCount,
    isVerified: extras.isVerified,
    isFollowing: extras.isFollowing,
    followedAt: extras.followedAt ?? null,
    languages: host.languages,
    user: host.user,
  };
}

export function serializeFollowerUser(
  row: {
    id: string;
    userId: string;
    hostId: string;
    createdAt: Date;
    deletedAt: Date | null;
    user: { id: string; displayName: string; avatarUrl: string | null };
  },
  completedCalls = 0,
) {
  return {
    id: row.id,
    userId: row.userId,
    hostId: row.hostId,
    createdAt: row.createdAt,
    user: row.user,
    completedCalls,
  };
}

export function growthPercent(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export { averageRating };