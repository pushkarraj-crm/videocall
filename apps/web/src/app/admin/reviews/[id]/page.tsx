'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, Trash2, EyeOff, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminReview } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/page-loader';
import { StarRating } from '@/components/reviews/star-rating';

export default function AdminReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [review, setReview] = useState<AdminReview | null>(null);
  const [call, setCall] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    adminApi
      .getReview(id)
      .then((res) => {
        setReview(res.review);
        setCall(res.call);
      })
      .catch(() => toast.error('Review not found'));
  }, [id]);

  const handleAction = async (action: 'hide' | 'report' | 'delete') => {
    try {
      if (action === 'delete') {
        await adminApi.deleteReview(id);
        toast.success('Review deleted');
        router.push('/admin/reviews');
        return;
      }
      await adminApi.updateReview(id, action);
      toast.success('Review updated');
      const res = await adminApi.getReview(id);
      setReview(res.review);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    }
  };

  if (!review) return <PageLoader label="Loading review..." />;

  return (
    <div className="premium-glow-bg mx-auto max-w-2xl space-y-6 pb-10">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/reviews">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to reviews
        </Link>
      </Button>

      <div className="premium-card border-white/8 bg-[#17171C]/90 p-6">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <h1 className="text-xl font-bold">Review Detail</h1>
        </div>

        <div className="mt-4">
          <StarRating value={review.rating} readonly size="md" />
        </div>

        {review.reviewText && (
          <p className="mt-4 rounded-[16px] border border-white/8 bg-white/5 p-4 text-sm leading-relaxed">
            {review.reviewText}
          </p>
        )}

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-white/8 pb-2">
            <dt className="text-muted-foreground">User</dt>
            <dd>{review.user?.displayName ?? review.userId}</dd>
          </div>
          <div className="flex justify-between border-b border-white/8 pb-2">
            <dt className="text-muted-foreground">Host</dt>
            <dd>{review.host?.displayName ?? review.hostId}</dd>
          </div>
          <div className="flex justify-between border-b border-white/8 pb-2">
            <dt className="text-muted-foreground">Submitted</dt>
            <dd>{new Date(review.createdAt).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between border-b border-white/8 pb-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              {review.isHidden ? 'Hidden' : 'Visible'}
              {review.isReported ? ' · Reported' : ''}
            </dd>
          </div>
        </dl>

        {call && (
          <div className="mt-6 rounded-[16px] border border-white/8 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Linked Call
            </p>
            <p className="mt-2 text-sm">
              Duration: {String(call.durationSeconds ?? 0)}s · Status: {String(call.status)}
            </p>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link href={`/admin/calls?q=${review.callId}`}>View Call Record</Link>
            </Button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleAction('hide')}>
            <EyeOff className="mr-2 h-4 w-4" />
            Hide Review
          </Button>
          <Button variant="outline" onClick={() => handleAction('report')}>
            <Flag className="mr-2 h-4 w-4" />
            Mark Reported
          </Button>
          <Button variant="destructive" onClick={() => handleAction('delete')}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Review
          </Button>
        </div>
      </div>
    </div>
  );
}