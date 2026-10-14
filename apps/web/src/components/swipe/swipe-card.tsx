'use client';

import Link from 'next/link';
import { Heart, X, Star, Coins, Languages } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { COINS_PER_MINUTE } from '@/lib/constants';
import { hostRating } from '@/lib/utils';
import type { HostDiscoverItem } from '@/types/api';

interface SwipeCardProps {
  host: HostDiscoverItem;
  onLike: () => void;
  onPass: () => void;
}

export function SwipeCard({ host, onLike, onPass }: SwipeCardProps) {
  return (
    <div className="relative w-full max-w-sm animate-slide-up">
      <div className="premium-card overflow-hidden rounded-[24px] shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
        <div className="gradient-primary relative aspect-[3/4]">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar className="h-36 w-36 border-4 border-white/30 shadow-xl">
              <AvatarImage src={host.user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-5xl bg-white/20 text-white">
                {host.user.displayName[0]}
              </AvatarFallback>
            </Avatar>
          </div>
          {host.isAvailable && (
            <Badge variant="success" className="absolute right-4 top-4">Live</Badge>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
            <Link href={`/profiles/${host.user.id}`}>
              <h2 className="text-2xl font-bold">{host.user.displayName}</h2>
            </Link>
            <p className="mt-1 line-clamp-2 text-sm text-white/80">{host.user.bio ?? 'Verified host'}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {hostRating(host.rating)}
              </span>
              {host.user.primaryLanguage && (
                <span className="flex items-center gap-1">
                  <Languages className="h-4 w-4" />
                  {host.user.primaryLanguage.toUpperCase()}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Coins className="h-4 w-4" />
                {COINS_PER_MINUTE} coins/min
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-8">
        <Button
          size="icon"
          variant="outline"
          className="h-16 w-16 rounded-full border-2 border-destructive/30 bg-card shadow-lg hover:bg-destructive/10"
          onClick={onPass}
        >
          <X className="h-8 w-8 text-destructive" />
        </Button>
        <Button
          size="icon"
          className="h-16 w-16 rounded-full gradient-primary border-0 shadow-lg"
          onClick={onLike}
        >
          <Heart className="h-8 w-8 fill-current" />
        </Button>
      </div>
    </div>
  );
}