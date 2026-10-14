'use client';

import Link from 'next/link';
import { Video, Star, Coins, BadgeCheck, Users } from 'lucide-react';
import { FollowButton } from '@/components/follows/follow-button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { COINS_PER_MINUTE } from '@/lib/constants';
import { hostRating } from '@/lib/utils';
import type { HostDiscoverItem } from '@/types/api';
import { HostStatusBadge } from '@/components/hosts/host-status-badge';
import { canReceiveCalls } from '@/lib/host-status';

interface HostCardProps {
  host: HostDiscoverItem;
  onCall?: (hostId: string) => void;
  compact?: boolean;
}

export function HostCard({ host, onCall, compact }: HostCardProps) {
  const callable = canReceiveCalls(host);

  return (
    <Card className="overflow-hidden border-0 shadow-md glass-card">
      <CardContent className={compact ? 'flex items-center gap-3 p-3' : 'p-4'}>
        <Link href={`/profiles/${host.user.id}`} className="shrink-0">
          <Avatar className={compact ? 'h-12 w-12' : 'h-16 w-16'}>
            <AvatarImage src={host.user.avatarUrl ?? undefined} />
            <AvatarFallback className="gradient-primary text-primary-foreground">
              {host.user.displayName[0]}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/profiles/${host.user.id}`} className="truncate font-semibold hover:text-primary">
              {host.user.displayName}
            </Link>
            {host.isVerified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Verified host" />
            )}
            <HostStatusBadge
              compact
              isOnline={host.isOnline ?? host.isAvailable}
              isBusy={host.isBusy}
              status={host.status}
            />
          </div>
          {!compact && host.user.bio && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{host.user.bio}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {hostRating(host.rating)}
              {host.reviewCount != null && host.reviewCount > 0 && (
                <span className="text-[#A7A7B3]">({host.reviewCount} Reviews)</span>
              )}
            </span>
            {(host.followerCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="h-3 w-3" />
                {host.followerCount}
              </span>
            )}
            {host.user.primaryLanguage && <span>{host.user.primaryLanguage.toUpperCase()}</span>}
            <span className="flex items-center gap-0.5 text-primary">
              <Coins className="h-3 w-3" />
              {COINS_PER_MINUTE}/min
            </span>
          </div>
        </div>
        <FollowButton hostId={host.userId} initialFollowing={host.isFollowing} compact />
        {onCall && (
          <Button
            size="sm"
            className="shrink-0 gradient-primary border-0 shadow-md"
            onClick={() => onCall(host.user.id)}
            disabled={!callable}
          >
            <Video className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}