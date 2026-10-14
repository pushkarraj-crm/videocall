'use client';

import { Loader2, Shuffle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchQueueProps {
  status?: 'searching' | 'found';
  searching?: boolean;
  queuePosition?: number;
}

export function MatchQueue({ status, searching, queuePosition }: MatchQueueProps) {
  const active = searching ?? (status === 'searching' || status === 'found');
  if (!active) return null;

  const found = status === 'found';

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative">
        <div className="flex h-32 w-32 items-center justify-center rounded-full gradient-primary shadow-2xl">
          <Shuffle className="h-12 w-12 animate-pulse text-primary-foreground" />
        </div>
        <div className="absolute inset-0 animate-pulse rounded-full border-4 border-primary/40" />
        <div className="absolute inset-0 animate-pulse rounded-full border-2 border-accent/30 [animation-delay:0.5s]" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">
          {found ? 'Match found!' : 'Finding your match...'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {found ? 'Connecting you now' : 'Connecting you with an online host'}
        </p>
        {queuePosition != null && (
          <p className={cn('mt-2 flex items-center justify-center gap-1 text-sm text-primary')}>
            <Users className="h-4 w-4" />
            Queue position: {queuePosition}
          </p>
        )}
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}