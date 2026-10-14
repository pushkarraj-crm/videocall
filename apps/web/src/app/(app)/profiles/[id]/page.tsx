'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Video,
  Phone,
  MapPin,
  ImageIcon,
  AlertTriangle,
  Star,
  BadgeCheck,
  Clock,
  PhoneCall,
} from 'lucide-react';
import { hostRating } from '@/lib/utils';
import { FollowButton } from '@/components/follows/follow-button';
import { ReportUserDialog } from '@/components/reports/report-user-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/page-loader';
import { usersApi, type PublicUserProfile } from '@/lib/api/users';
import { useCallFlow } from '@/hooks/use-call-flow';
import { HostStatusBadge } from '@/components/hosts/host-status-badge';
import { canReceiveCalls } from '@/lib/host-status';

export default function ProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { startCall } = useCallFlow();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [calling, setCalling] = useState<'audio' | 'video' | null>(null);

  useEffect(() => {
    usersApi
      .getPublicProfile(id)
      .then(setProfile)
      .catch(() => toast.error('Profile not found'));
  }, [id]);

  const handleCall = async (type: 'audio' | 'video') => {
    setCalling(type);
    try {
      await startCall(id);
    } finally {
      setCalling(null);
    }
  };

  if (!profile) return <PageLoader variant="profile" />;

  const host = profile.hostProfile;
  const stats = profile.ratingStats;
  const followStats = profile.followStats;
  const callable = host ? canReceiveCalls(host) : false;
  const isOnline = host?.isOnline ?? host?.isAvailable;
  const region = profile.primaryLanguage?.toUpperCase() ?? 'GLOBAL';
  const galleryUrls = profile.hostProfile?.virtualHostGallery ?? [];

  return (
    <div className="animate-fade-in min-h-full bg-[#0F0F12] pb-8">
      <div className="relative aspect-[4/5] max-h-[420px] w-full overflow-hidden">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF2E74]/25 to-[#17171C] text-7xl font-bold text-white/70">
            {profile.displayName?.[0]}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F12] via-transparent to-[#0F0F12]/30" />
        {host && isOnline && (
          <div className="absolute right-4 top-4">
            <HostStatusBadge
              compact
              isOnline={host.isOnline ?? host.isAvailable}
              isBusy={host.isBusy}
              status={host.status}
              lastSeenLabel={host.lastSeenLabel}
              className="bg-black/50"
            />
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-16 space-y-6 px-4">
        <div className="premium-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{profile.displayName}</h1>
            {stats?.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-400">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
            {profile.communityWarningVisible && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Community Warning
              </span>
            )}
          </div>
          {(stats || followStats) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {stats && (
                <span className="flex items-center gap-1 font-semibold text-amber-400">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {hostRating(stats.averageRating)}
                  <span className="font-normal text-[#A7A7B3]">
                    ({stats.totalReviews} Reviews)
                  </span>
                </span>
              )}
              {followStats && (
                <span className="text-[#A7A7B3]">
                  {followStats.followerCount} followers
                </span>
              )}
            </div>
          )}
          {host && followStats && (
            <div className="mt-4">
              <FollowButton hostId={id} initialFollowing={followStats.isFollowing} />
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#A7A7B3]">
            <span className="capitalize">{profile.gender ?? 'Member'}</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#FFB347]" />
              {region}
            </span>
          </div>

          <div className="mt-5 flex gap-3">
            <Button
              variant="outline"
              className="h-12 flex-1 rounded-[20px] border-white/10 bg-[#17171C] text-base font-semibold text-white hover:bg-[#1e1e24]"
              onClick={() => handleCall('audio')}
              disabled={calling !== null || !callable}
            >
              <Phone className="mr-2 h-5 w-5" />
              {calling === 'audio'
                ? 'Calling…'
                : callable
                  ? 'Audio Call'
                  : host?.isBusy
                    ? 'Busy'
                    : 'Offline'}
            </Button>
            <Button
              className="h-12 flex-1 rounded-[20px] gradient-primary border-0 text-base font-semibold shadow-[0_4px_24px_rgba(255,46,116,0.35)]"
              onClick={() => handleCall('video')}
              disabled={calling !== null || !callable}
            >
              <Video className="mr-2 h-5 w-5" />
              {calling === 'video'
                ? 'Calling…'
                : callable
                  ? 'Video Call'
                  : host?.isBusy
                    ? 'Busy'
                    : 'Offline'}
            </Button>
          </div>
        </div>

        {stats && (
          <section className="premium-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
              Host Stats
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-[16px] border border-white/8 bg-white/5 p-3 text-center">
                <PhoneCall className="mx-auto h-4 w-4 text-[#FF2E74]" />
                <p className="mt-1 text-lg font-bold text-white">{stats.totalCalls}</p>
                <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Total Calls</p>
              </div>
              <div className="rounded-[16px] border border-white/8 bg-white/5 p-3 text-center">
                <p className="text-lg font-bold text-white">
                  {stats.responseRate != null ? `${stats.responseRate}%` : '—'}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Response Rate</p>
              </div>
              <div className="rounded-[16px] border border-white/8 bg-white/5 p-3 text-center">
                <Clock className="mx-auto h-4 w-4 text-[#FFB347]" />
                <p className="mt-1 text-lg font-bold text-white">
                  {stats.responseTimeSeconds != null
                    ? `${stats.responseTimeSeconds}s`
                    : '—'}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Response Time</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#A7A7B3]">
              <span>
                Member since{' '}
                {new Date(stats.memberSince).toLocaleDateString('en-IN', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              {Array.isArray(stats.languages) && stats.languages.length > 0 && (
                <span>Languages: {(stats.languages as string[]).join(', ')}</span>
              )}
            </div>
          </section>
        )}

        {(profile.bio || host?.hostBio) && (
          <section className="premium-card p-5 sm:p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
              About
            </h2>
            <p className="text-sm leading-relaxed text-white/90 sm:text-base">
              {host?.hostBio ?? profile.bio}
            </p>
          </section>
        )}

        <section className="premium-card p-5 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
            <ImageIcon className="h-4 w-4" />
            Gallery
          </h2>
          {galleryUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {galleryUrls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  className="group aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl border border-white/8 bg-black/20"
                  onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                >
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#A7A7B3]">No gallery photos yet</p>
          )}
        </section>

        <ReportUserDialog
          reportedUserId={id}
          reportedUserName={profile.displayName}
          className="w-full"
        />
      </div>
    </div>
  );
}