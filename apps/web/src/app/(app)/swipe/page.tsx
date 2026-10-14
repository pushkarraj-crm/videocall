'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Heart, RotateCcw, Sparkles } from 'lucide-react';
import { SwipeCard } from '@/components/swipe/swipe-card';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/shared/screen';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import { useHosts } from '@/hooks/use-hosts';

export default function SwipePage() {
  const { hosts, loading } = useHosts({ onlineOnly: false });
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState<string[]>([]);

  const current = hosts[index];

  const handleLike = useCallback(() => {
    if (!current) return;
    setLikes((prev) => [...prev, current.userId]);
    setIndex((i) => i + 1);
  }, [current]);

  const handlePass = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const reset = () => {
    setIndex(0);
    setLikes([]);
  };

  if (loading) {
    return (
      <Screen className="flex flex-col items-center pt-4">
        <PageSkeleton variant="discover" className="w-full" />
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen>
        <PageHeader
          title="Swipe"
          subtitle="Discover hosts quickly"
          icon={<Sparkles className="h-5 w-5 text-[#FF2E74]" />}
        />
        <div className="premium-card">
          <EmptyState
            icon={Heart}
            title="No more hosts"
            description={
              likes.length > 0
                ? `You liked ${likes.length} host${likes.length === 1 ? '' : 's'}. Start over or browse discover.`
                : 'Try adjusting filters on the discover page.'
            }
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="gradient" onClick={reset}>
                  <RotateCcw className="h-4 w-4" />
                  Start over
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/home">Browse discover</Link>
                </Button>
              </div>
            }
          />
        </div>
      </Screen>
    );
  }

  return (
    <Screen className="flex flex-col items-center pt-2">
      <PageHeader title="Swipe" subtitle={`${hosts.length - index} remaining`} />
      <SwipeCard host={current} onLike={handleLike} onPass={handlePass} />
    </Screen>
  );
}