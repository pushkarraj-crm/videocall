'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { followsApi } from '@/lib/api/follows';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  hostId: string;
  initialFollowing?: boolean;
  compact?: boolean;
  className?: string;
  onChange?: (following: boolean, followerCount?: number) => void;
}

export function FollowButton({
  hostId,
  initialFollowing = false,
  compact = false,
  className,
  onChange,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (following) {
        const res = await followsApi.unfollow(hostId);
        setFollowing(false);
        onChange?.(false, res.followerCount);
        toast.success('Removed from favorites');
      } else {
        const res = await followsApi.follow(hostId);
        setFollowing(true);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
        onChange?.(true, res.followerCount);
        toast.success('Added to favorites');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border transition-all duration-300',
        compact ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm font-semibold',
        following
          ? 'border-[#FF2E74]/40 bg-[#FF2E74]/15 text-[#FF6B9D]'
          : 'border-white/12 bg-white/5 text-white hover:border-[#FF2E74]/30 hover:bg-[#FF2E74]/10',
        pulse && 'scale-110',
        className,
      )}
      aria-pressed={following}
    >
      <Heart
        className={cn(
          compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
          'transition-all duration-300',
          following ? 'fill-[#FF2E74] text-[#FF2E74]' : 'text-white/70',
          pulse && 'animate-ping',
        )}
      />
      {following ? 'Following' : 'Follow'}
    </button>
  );
}