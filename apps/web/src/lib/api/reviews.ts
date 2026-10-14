import { apiClient } from './client';

export interface ReviewItem {
  id: string;
  callId: string;
  hostId: string;
  userId: string;
  rating: number;
  reviewText: string | null;
  isHidden: boolean;
  isReported: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; displayName: string; avatarUrl: string | null } | null;
  host?: { id: string; displayName: string; avatarUrl: string | null } | null;
}

export interface ReviewEligibility {
  eligible: boolean;
  reason: string | null;
  hostId: string | null;
  hostName: string | null;
  existingReview: ReviewItem | null;
}

export interface HostRatingSummary {
  averageRating: number | null;
  totalReviews: number;
  totalCalls: number;
  starDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  latestReviews: ReviewItem[];
  averageMonthlyRating: number | null;
  monthlyReviewCount: number;
  positivePercent: number;
  negativePercent: number;
  responseRate: number | null;
  responseTimeSeconds: number | null;
  memberSince: string;
  languages: string[];
  isVerified: boolean;
}

export interface PublicHostRatingStats {
  averageRating: number | null;
  totalReviews: number;
  totalCalls: number;
  responseRate: number | null;
  responseTimeSeconds: number | null;
  memberSince: string;
  languages: string[];
  isVerified: boolean;
}

export const reviewsApi = {
  create: (data: { callId: string; rating: number; reviewText?: string }) =>
    apiClient<ReviewItem>('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  eligibility: (callId: string) =>
    apiClient<ReviewEligibility>(`/reviews/eligibility/${callId}`),

  hostReviews: (page = 1, limit = 20) =>
    apiClient<{ items: ReviewItem[]; total: number; page: number; limit: number }>(
      `/host/reviews?page=${page}&limit=${limit}`,
    ),

  hostRating: () => apiClient<HostRatingSummary>('/host/rating'),
};