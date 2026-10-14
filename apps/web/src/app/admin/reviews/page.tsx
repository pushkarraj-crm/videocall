'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Star, Trash2, EyeOff, Eye, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminReview, type ReviewAnalytics } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { StarRating } from '@/components/reviews/star-rating';
import { cn } from '@/lib/utils';

const RATING_FILTERS = [
  { value: '', label: 'All ratings' },
  { value: '5', label: '5 Star' },
  { value: '4', label: '4 Star' },
  { value: '3', label: '3 Star' },
  { value: '2', label: '2 Star' },
  { value: '1', label: '1 Star' },
];

export default function AdminReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('');
  const [filter, setFilter] = useState<'' | 'reported' | 'hidden' | 'visible'>('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.reviews({
        search: search.trim() || undefined,
        rating: rating ? parseInt(rating, 10) : undefined,
        filter: filter || undefined,
        sort,
        limit: 30,
      });
      setReviews(res.items);
      setTotal(res.total);
      setAnalytics(res.analytics);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [search, rating, filter, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (id: string, action: 'hide' | 'unhide' | 'report' | 'delete') => {
    try {
      if (action === 'delete') {
        await adminApi.deleteReview(id);
        toast.success('Review deleted');
      } else {
        await adminApi.updateReview(id, action);
        toast.success(`Review ${action === 'hide' ? 'hidden' : action === 'unhide' ? 'unhidden' : 'updated'}`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    }
  };

  if (loading && reviews.length === 0) {
    return <PageLoader label="Loading reviews..." />;
  }

  return (
    <div className="premium-glow-bg mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-sm text-muted-foreground">{total} total reviews</p>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.averagePlatformRating?.toFixed(1) ?? '—'}</p>
            <p className="text-xs text-muted-foreground">App avg</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.reviewsToday}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.reviewsThisMonth}</p>
            <p className="text-xs text-muted-foreground">This month</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.totalReviews}</p>
            <p className="text-xs text-muted-foreground">All time</p>
          </div>
        </div>
      )}

      <div className="premium-card space-y-3 border-white/8 bg-[#17171C]/90 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search host, user, review text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            {RATING_FILTERS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as '' | 'reported' | 'hidden' | 'visible')
            }
          >
            <option value="">All reviews</option>
            <option value="reported">Reported</option>
            <option value="hidden">Hidden</option>
            <option value="visible">Visible</option>
          </select>
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className={cn(
              'premium-card border-white/8 bg-[#17171C]/90 p-4',
              review.isHidden && 'opacity-60',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StarRating value={review.rating} readonly size="sm" />
                  {review.isReported && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
                      Reported
                    </span>
                  )}
                  {review.isHidden && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[#A7A7B3]">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-white">
                  <span className="text-[#A7A7B3]">User:</span>{' '}
                  {review.user?.displayName ?? review.userId}
                  <span className="mx-2 text-white/20">→</span>
                  <span className="text-[#A7A7B3]">Host:</span>{' '}
                  {review.host?.displayName ?? review.hostId}
                </p>
                {review.reviewText && (
                  <p className="mt-1 text-sm text-[#A7A7B3]">{review.reviewText}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => router.push(`/admin/reviews/${review.id}`)}>
                  View
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/admin/calls?q=${review.callId}`}>View Call</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleAction(review.id, review.isHidden ? 'unhide' : 'hide')
                  }
                >
                  {review.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(review.id, 'report')}
                >
                  <Flag className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleAction(review.id, 'delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {reviews.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No reviews found</p>
        )}
      </div>
    </div>
  );
}