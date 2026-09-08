import { averageRating } from './host-rating-stats';

const USER_PREVIEW = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

export type ReviewUserPreview = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ReviewRow = {
  id: string;
  callId: string;
  hostId: string;
  userId: string;
  rating: number;
  reviewText: string | null;
  isHidden: boolean;
  isReported: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: ReviewUserPreview;
  host?: ReviewUserPreview;
};

export function serializeReview(row: ReviewRow) {
  return {
    id: row.id,
    callId: row.callId,
    hostId: row.hostId,
    userId: row.userId,
    rating: row.rating,
    reviewText: row.reviewText,
    isHidden: row.isHidden,
    isReported: row.isReported,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: row.user ?? null,
    host: row.host ?? null,
  };
}

export function serializeHostRatingSummary(profile: {
  ratingSum: number;
  ratingCount: number;
  totalCalls: number;
}) {
  return {
    averageRating: averageRating(profile.ratingSum, profile.ratingCount),
    totalReviews: profile.ratingCount,
    totalCalls: profile.totalCalls,
    ratingSum: profile.ratingSum,
    ratingCount: profile.ratingCount,
  };
}

export { USER_PREVIEW as REVIEW_USER_SELECT };