'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

export function StarRating({
  value,
  onChange,
  size = 'md',
  readonly = false,
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      onMouseLeave={() => !readonly && setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={cn(
              'transition-transform duration-200',
              !readonly && 'hover:scale-110 active:scale-95',
              readonly && 'cursor-default',
            )}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHover(star)}
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={cn(
                SIZES[size],
                'transition-colors duration-200',
                filled
                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : 'text-white/25',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}