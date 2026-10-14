'use client';

import { Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hostRating } from '@/lib/utils';
import type { HostRatingSummary } from '@/lib/api/reviews';
import { StarRating } from './star-rating';

interface HostReviewsCardProps {
  rating: HostRatingSummary;
}

export function HostReviewsCard({ rating }: HostReviewsCardProps) {
  const total = rating.totalReviews;
  const maxBar = Math.max(...Object.values(rating.starDistribution), 1);

  return (
    <Card className="premium-card overflow-hidden border-white/8 bg-[#17171C]/90">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          Reviews
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-[20px] border border-white/8 bg-white/5 px-4 py-4">
          <div>
            <p className="text-3xl font-bold text-white">
              {hostRating(rating.averageRating)}
            </p>
            <p className="text-xs text-[#A7A7B3]">{total} total reviews</p>
          </div>
          <StarRating value={Math.round(rating.averageRating ?? 0)} readonly size="sm" />
        </div>

        <div className="space-y-2">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = rating.starDistribution[star];
            const width = `${Math.round((count / maxBar) * 100)}%`;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-[#A7A7B3]">{star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
                    style={{ width }}
                  />
                </div>
                <span className="w-6 text-right text-[#A7A7B3]">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
            <p className="text-lg font-bold text-white">
              {rating.averageMonthlyRating?.toFixed(1) ?? '—'}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Monthly avg</p>
          </div>
          <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-emerald-400">
              <ThumbsUp className="h-4 w-4" />
              {rating.positivePercent}%
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Positive</p>
          </div>
          <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-red-400">
              <ThumbsDown className="h-4 w-4" />
              {rating.negativePercent}%
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Negative</p>
          </div>
        </div>

        {rating.latestReviews.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#A7A7B3]">
              Latest reviews
            </p>
            {rating.latestReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-[16px] border border-white/8 bg-white/5 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">
                    {review.user?.displayName ?? 'User'}
                  </p>
                  <StarRating value={review.rating} readonly size="sm" />
                </div>
                {review.reviewText && (
                  <p className="mt-1 text-xs leading-relaxed text-[#A7A7B3]">{review.reviewText}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}