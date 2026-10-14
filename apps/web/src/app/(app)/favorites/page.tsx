'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Phone, Search, Star, Video, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { followsApi, type FavoriteHostItem } from '@/lib/api/follows';
import { FollowButton } from '@/components/follows/follow-button';
import { HostStatusBadge } from '@/components/hosts/host-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { PageHeader } from '@/components/shared/page-header';
import { Screen } from '@/components/shared/screen';
import { EmptyState } from '@/components/shared/empty-state';
import { useCallFlow } from '@/hooks/use-call-flow';
import { canReceiveCalls } from '@/lib/host-status';
import { hostRating, cn } from '@/lib/utils';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Rating' },
  { value: 'online', label: 'Online First' },
] as const;

export default function FavoritesPage() {
  const { startCall } = useCallFlow();
  const [items, setItems] = useState<FavoriteHostItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'rating' | 'online'>('newest');

  const load = useCallback(
    async (pageNum: number, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await followsApi.favorites({
          page: pageNum,
          limit: 20,
          search: search.trim() || undefined,
          sort,
        });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setPage(pageNum);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load favorites');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, sort],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const removeFromList = (hostId: string) => {
    setItems((prev) => prev.filter((h) => h.userId !== hostId));
    setTotal((t) => Math.max(0, t - 1));
  };

  if (loading && items.length === 0) {
    return <PageLoader variant="list" />;
  }

  return (
    <Screen>
      <PageHeader
        title="Favorites"
        subtitle={`${total} hosts you follow`}
        icon={<Heart className="h-5 w-5 fill-[#FF2E74] text-[#FF2E74]" />}
      />

      <div className="premium-card space-y-3 border-white/8 bg-[#17171C]/90 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A7A7B3]" />
          <Input
            className="border-white/10 bg-white/5 pl-9 text-white"
            placeholder="Search favorites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSort(opt.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                sort === opt.value
                  ? 'gradient-primary text-white'
                  : 'border border-white/10 bg-white/5 text-[#A7A7B3]',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="premium-card">
          <EmptyState
            icon={Heart}
            title="No favorites yet"
            description="Follow hosts you enjoy — they'll appear here for quick access."
            action={
              <Button variant="gradient" asChild>
                <Link href="/home">Discover hosts</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((host) => {
            const callable = canReceiveCalls(host);
            const langs = Array.isArray(host.languages)
              ? (host.languages as string[]).join(', ')
              : null;
            return (
              <article
                key={host.userId}
                className="premium-card overflow-hidden border-white/8 bg-[#17171C]/90 p-4"
              >
                <div className="flex gap-3">
                  <Link href={`/profiles/${host.user.id}`} className="shrink-0">
                    <div className="relative h-16 w-16 overflow-hidden rounded-[16px]">
                      {host.user.avatarUrl ? (
                        <img
                          src={host.user.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF2E74]/30 to-[#17171C] font-bold text-white">
                          {host.user.displayName[0]}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/profiles/${host.user.id}`}
                        className="truncate font-semibold text-white hover:text-[#FF6B9D]"
                      >
                        {host.user.displayName}
                      </Link>
                      {host.isVerified && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#A7A7B3]">
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <Star className="h-3 w-3 fill-amber-400" />
                        {hostRating(host.rating)}
                      </span>
                      <span>{host.followerCount ?? 0} followers</span>
                      {langs && <span>{langs}</span>}
                    </div>
                    <div className="mt-1.5">
                      <HostStatusBadge
                        compact
                        isOnline={host.isOnline}
                        isBusy={host.isBusy}
                        status={host.status}
                        lastSeenLabel={host.lastSeenLabel}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gradient-primary flex-1 border-0"
                    disabled={!callable}
                    onClick={() => startCall(host.user.id)}
                  >
                    <Video className="mr-1 h-3.5 w-3.5" />
                    Video
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-white/12 bg-white/5 text-white"
                    disabled={!callable}
                    onClick={() => startCall(host.user.id)}
                  >
                    <Phone className="mr-1 h-3.5 w-3.5" />
                    Audio
                  </Button>
                  <FollowButton
                    hostId={host.userId}
                    initialFollowing
                    compact
                    onChange={(following) => {
                      if (!following) removeFromList(host.userId);
                    }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {items.length < total && (
        <Button
          variant="outline"
          className="w-full border-white/12 bg-white/5 text-white"
          disabled={loadingMore}
          onClick={() => load(page + 1, true)}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </Screen>
  );
}