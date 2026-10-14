'use client';

import Link from 'next/link';
import { Video, Star, BadgeCheck, Users, Coins } from 'lucide-react';
import { cn, hostRating } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FollowButton } from '@/components/follows/follow-button';
import type { HostDiscoverItem } from '@/types/api';
import { HostStatusBadge } from '@/components/hosts/host-status-badge';
import { canReceiveCalls } from '@/lib/host-status';

interface DiscoverHostCardProps {
  host: HostDiscoverItem;
  onCall?: (hostId: string) => void;
  onFollowChange?: (hostId: string, followerCount: number) => void;
}

export function DiscoverHostCard({ host, onCall, onFollowChange }: DiscoverHostCardProps) {
  const gallery = host.virtualHostGallery ?? [];
  const age = host.age;
  const callable = canReceiveCalls(host);
  const isOnline = host.isOnline ?? host.isAvailable;
  const coinsPerMinute = host.coinsPerMinute ?? 5;
  return (
    <article className="group hover-lift animate-slide-up relative overflow-hidden rounded-2xl border border-white/8 bg-[#17171C] shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-shadow duration-300 hover:border-[#FF2E74]/25 hover:shadow-[0_12px_40px_rgba(255,46,116,0.15)] sm:rounded-[24px]">
      <Link href={`/profiles/${host.user.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden">
          {host.user.avatarUrl ? (
            <img
              src={host.user.avatarUrl}
              alt={host.user.displayName}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={cn(
              'flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF2E74]/30 to-[#17171C] text-5xl font-bold text-white/80',
              host.user.avatarUrl && 'hidden absolute inset-0',
            )}
          >
            {host.user.displayName?.[0] ?? '?'}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F12] via-[#0F0F12]/25 to-transparent" />
          <div className="absolute left-3 top-3">
            <FollowButton
              hostId={host.userId}
              initialFollowing={host.isFollowing}
              compact
              onChange={(_, count) => {
                if (count != null) onFollowChange?.(host.userId, count);
              }}
            />
          </div>
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            {isOnline && (
              <HostStatusBadge
                compact
                isOnline={host.isOnline ?? host.isAvailable}
                isBusy={host.isBusy}
                status={host.status}
                lastSeenLabel={host.lastSeenLabel}
                className="bg-black/50"
              />
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
            <div className="flex items-center gap-1.5 pr-12">
              <h3 className="truncate text-base font-semibold text-white sm:text-lg">
                {host.user.displayName}
              </h3>
              {host.isVerified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Verified host" />
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#A7A7B3]">
              {age != null && <span>{age}</span>}
              {age != null && <span className="text-white/20">·</span>}
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {hostRating(host.rating)}
              </span>
              <span className="text-white/20">·</span>
              <span className="inline-flex items-center gap-0.5 text-[#FFB347]">
                <Coins className="h-3 w-3" />
                {coinsPerMinute}/min
              </span>
            </div>
            {(host.followerCount ?? 0) > 0 && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-[#A7A7B3]">
                <Users className="h-3 w-3" />
                {host.followerCount} followers
              </div>
            )}
            {gallery.length > 0 && (
              <div className="mt-2 hidden gap-1 sm:flex">
                {gallery.slice(0, 4).map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-8 w-8 rounded-md object-cover ring-1 ring-white/10"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
      {onCall && (
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
          <Button
            size="icon"
            className="h-10 w-10 rounded-full gradient-primary border-0 shadow-[0_4px_20px_rgba(255,46,116,0.4)] transition-transform hover:scale-110 sm:h-11 sm:w-11"
            onClick={(e) => {
              e.preventDefault();
              onCall(host.user.id);
            }}
            disabled={!callable}
            aria-label={
              callable
                ? `Video call ${host.user.displayName}`
                : host.isBusy
                  ? `${host.user.displayName} is busy`
                  : `${host.user.displayName} is offline`
            }
          >
            <Video className="h-5 w-5" />
          </Button>
        </div>
      )}
    </article>
  );
}