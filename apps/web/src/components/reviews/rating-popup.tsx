'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { reviewsApi } from '@/lib/api/reviews';
import { cn } from '@/lib/utils';
import { StarRating } from './star-rating';

interface RatingPopupProps {
  callId: string;
  hostName?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function RatingPopup({ callId, hostName, onClose, onSubmitted }: RatingPopupProps) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error('Please select a star rating');
      return;
    }
    setSubmitting(true);
    try {
      await reviewsApi.create({
        callId,
        rating,
        reviewText: reviewText.trim() || undefined,
      });
      toast.success('Thanks for your feedback!');
      onSubmitted?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        className="animate-in fade-in slide-in-from-bottom-4 w-full max-w-md rounded-[28px] border border-white/10 bg-[#17171C]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        role="dialog"
        aria-labelledby="rating-title"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="rating-title" className="text-xl font-bold text-white">
              Rate your experience
            </h2>
            {hostName && (
              <p className="mt-1 text-sm text-[#A7A7B3]">How was your call with {hostName}?</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#A7A7B3] hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-center py-4">
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>

        <textarea
          placeholder="Optional review (share what went well)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          maxLength={1000}
          className={cn(
            'min-h-[88px] w-full resize-none rounded-[16px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[#A7A7B3] focus:outline-none focus:ring-1 focus:ring-[#FF2E74]/50',
          )}
        />

        <div className="mt-5 flex gap-3">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-[16px] border-white/12 bg-white/5 text-white"
            onClick={onClose}
            disabled={submitting}
          >
            Skip
          </Button>
          <Button
            className="h-11 flex-1 rounded-[16px] gradient-primary border-0 font-semibold"
            onClick={handleSubmit}
            disabled={submitting || rating < 1}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}