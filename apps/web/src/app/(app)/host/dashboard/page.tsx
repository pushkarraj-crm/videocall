'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Phone,
  TrendingUp,
  Wallet,
  Star,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostsApi, type EarningsSummary } from '@/lib/api/hosts';
import { reviewsApi, type HostRatingSummary } from '@/lib/api/reviews';
import { HostFollowersCard } from '@/components/follows/host-followers-card';
import { HostReviewsCard } from '@/components/reviews/host-reviews-card';
import { followsApi, type HostFollowersSummary } from '@/lib/api/follows';
import { referralApi, type HostReferralStats } from '@/lib/api/referral';
import { HostReferralCard } from '@/components/referrals/host-referral-card';
import { PageLoader } from '@/components/shared/page-loader';
import { HostPageShell, HostStatCard } from '@/components/host/host-page-shell';
import { HostIncomingCallPanel } from '@/components/host/host-incoming-call-panel';
import { formatInr, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { HostGiftsCard } from '@/components/gifts/host-gifts-card';
import { HostStatusBadge } from '@/components/hosts/host-status-badge';
import { HOST_STATUS_STYLES, type HostAvailabilityStatus } from '@/lib/host-status';
import { useHostHeartbeat } from '@/hooks/use-host-heartbeat';
import { ApiClientError } from '@/lib/api/client';
import { devLog } from '@/lib/dev-log';
import { syncHostAuthSession } from '@/lib/auth/host-registration';

interface HostDashboardData {
  profile: {
    isAvailable: boolean;
    isOnline?: boolean;
    isBusy?: boolean;
    status?: HostAvailabilityStatus;
    lastSeenLabel?: string;
    totalEarningsInr: number;
    withdrawableInr: number;
    totalCalls: number;
    rating: number | null;
    displayName?: string;
    avatarUrl?: string | null;
    bio?: string | null;
    gallery?: string[];
  };
}

function firstName(name?: string | null) {
  if (!name?.trim()) return 'Host';
  return name.trim().split(/\s+/)[0];
}

export default function HostDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<HostDashboardData | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [hostRating, setHostRating] = useState<HostRatingSummary | null>(null);
  const [followers, setFollowers] = useState<HostFollowersSummary | null>(null);
  const [referralStats, setReferralStats] = useState<HostReferralStats | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPageLoading(true);
    setLoadError(null);
    devLog('HOST_DASHBOARD_LOAD_START');

    try {
      await syncHostAuthSession().catch(() => undefined);

      const [dashboard, summary, status, rating, followersData, referralData] = await Promise.all([
        hostsApi.dashboard(),
        hostsApi.getEarnings(),
        hostsApi.getStatus(),
        reviewsApi.hostRating().catch(() => null),
        followsApi.hostFollowers().catch(() => null),
        referralApi.hostStats().catch(() => null),
      ]);

      devLog('HOST_DASHBOARD_LOAD_OK', {
        hasProfile: !!(dashboard as HostDashboardData).profile,
        earningsTotal: summary.totalEarnedInr,
        status: status.status,
      });

      const dash = dashboard as HostDashboardData;
      dash.profile = {
        ...dash.profile,
        isOnline: status.isOnline,
        isBusy: status.isBusy,
        status: status.status,
        lastSeenLabel: status.lastSeenLabel,
        isAvailable: status.canReceiveCalls,
      };
      setData(dash);
      setEarnings(summary);
      setHostRating(rating);
      setFollowers(followersData);
      setReferralStats(referralData);
    } catch (e) {
      const err = e instanceof ApiClientError ? e : null;
      const message = e instanceof Error ? e.message : 'Failed to load dashboard';
      devLog('HOST_DASHBOARD_LOAD_ERROR', {
        statusCode: err?.statusCode,
        code: err?.code,
        message,
      });

      if (err?.statusCode === 403 || err?.statusCode === 401) {
        toast.error('Complete host setup to access your dashboard');
        router.replace('/host/register');
        return;
      }

      setLoadError(message);
      toast.error(message);
    } finally {
      setPageLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOnline = data?.profile.isOnline ?? false;
  const isBusy = data?.profile.isBusy ?? false;
  useHostHeartbeat(isOnline, isBusy);

  const setOnlineStatus = async (next: 'ONLINE' | 'OFFLINE') => {
    setStatusLoading(true);
    try {
      await hostsApi.setStatus(next);
      toast.success(next === 'ONLINE' ? 'You are now online' : 'You are now offline');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  if (pageLoading) return <PageLoader variant="dashboard" />;

  if (loadError || !data || !earnings) {
    return (
      <div className="premium-glow-bg flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-[#A7A7B3]">{loadError ?? 'Could not load host dashboard'}</p>
        <div className="flex gap-3">
          <Button className="gradient-primary border-0" onClick={() => void load()}>
            Retry
          </Button>
          <Button
            variant="outline"
            className="border-white/12"
            onClick={() => router.replace('/host/register')}
          >
            Complete setup
          </Button>
        </div>
      </div>
    );
  }

  const { profile } = data;
  const status =
    profile.status ?? (profile.isOnline ? (profile.isBusy ? 'BUSY' : 'ONLINE') : 'OFFLINE');
  const statusStyle = HOST_STATUS_STYLES[status];
  const onlineActive = status === 'ONLINE';
  const offlineActive = status === 'OFFLINE';
  const hostName = profile.displayName ?? 'Host';
  const hostFirst = firstName(hostName);

  return (
    <HostPageShell className="space-y-6 sm:space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {hostFirst}&apos;s Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#A7A7B3] sm:text-base">
            Manage your availability and earnings
          </p>
        </div>
        <Button variant="outline" className="cursor-pointer border-white/12" asChild>
          <Link href="/settings/profile">Edit Profile</Link>
        </Button>
      </div>

      {/* Top: Availability (left) + Quick Stats (right) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Availability */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="border-b border-white/6 px-5 py-3.5 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Radio className="h-4 w-4 text-[#FF2E74]" />
              Availability
            </div>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            {/* Host identity inside Availability */}
            <div className="flex items-center gap-3.5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white/10 ring-2 ring-[#FF2E74]/20">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FF2E74]/35 to-[#17171C] text-lg font-bold text-white">
                    {hostFirst[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-white">{hostName}</p>
                <p className="text-sm text-[#A7A7B3]">Host</p>
                <div className="mt-0.5">
                  <HostStatusBadge
                    compact
                    isOnline={profile.isOnline}
                    isBusy={profile.isBusy}
                    status={status}
                    lastSeenLabel={profile.lastSeenLabel}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
                  Current status
                </p>
                <p
                  className={cn(
                    'mt-1 text-3xl font-bold tracking-tight',
                    statusStyle.badge.split(' ').pop(),
                  )}
                >
                  {status}
                </p>
                <p className="mt-1.5 text-sm text-[#A7A7B3]">
                  {profile.lastSeenLabel ??
                    (status === 'ONLINE' ? 'Visible in discover' : 'Hidden from discover')}
                </p>
              </div>
            </div>

            {/* Compact action buttons — not full width on desktop */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                className={cn(
                  'h-12 w-full min-w-[180px] max-w-full rounded-xl font-semibold sm:w-auto sm:min-w-[200px] sm:max-w-[240px]',
                  onlineActive || status === 'BUSY'
                    ? 'border border-white/12 bg-white/5 text-[#A7A7B3]'
                    : 'gradient-primary border-0 shadow-[0_6px_24px_rgba(255,46,116,0.3)]',
                )}
                disabled={statusLoading || status === 'BUSY' || status === 'ONLINE'}
                onClick={() => setOnlineStatus('ONLINE')}
              >
                Go Online
              </Button>
              <Button
                className={cn(
                  'h-12 w-full min-w-[180px] max-w-full rounded-xl font-semibold sm:w-auto sm:min-w-[200px] sm:max-w-[240px]',
                  offlineActive
                    ? 'border border-white/12 bg-white/5 text-[#A7A7B3]'
                    : onlineActive
                      ? 'gradient-primary border-0 shadow-[0_6px_24px_rgba(255,46,116,0.3)]'
                      : 'border border-white/12 bg-white/5 text-white hover:bg-white/10',
                )}
                disabled={statusLoading || status === 'BUSY' || status === 'OFFLINE'}
                onClick={() => setOnlineStatus('OFFLINE')}
              >
                Go Offline
              </Button>
            </div>

            {status === 'BUSY' && (
              <p className="text-center text-xs text-amber-400 sm:text-right">
                You are on a call. Status will return to ONLINE when the call ends.
              </p>
            )}
          </div>
        </section>

        {/* Quick stats — compact 2×2 on the right */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="border-b border-white/6 px-5 py-3.5 sm:px-5">
            <p className="text-sm font-semibold text-white">Quick Stats</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:gap-3 sm:p-5">
            <HostStatCard
              label="Earnings"
              value={formatInr(earnings.totalEarnedInr)}
              icon={TrendingUp}
              accent="text-emerald-400"
            />
            <HostStatCard
              label="Withdrawable"
              value={formatInr(earnings.withdrawableInr)}
              icon={Wallet}
            />
            <HostStatCard
              label="Calls"
              value={String(profile.totalCalls)}
              icon={Phone}
            />
            <HostStatCard
              label="Rating"
              value={profile.rating != null ? `${profile.rating.toFixed(1)} ★` : '—'}
              icon={Star}
              accent="text-amber-400"
            />
          </div>
        </section>
      </div>

      {/* Live incoming calls — no navigation to /calls/incoming */}
      <HostIncomingCallPanel />

      {/* Gifts + Referral */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <HostGiftsCard />
        <div className="space-y-5">
          {referralStats && <HostReferralCard stats={referralStats} />}
          {followers && <HostFollowersCard data={followers} />}
          {hostRating && <HostReviewsCard rating={hostRating} />}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          className="h-12 min-w-[180px] rounded-xl border-0 text-base font-semibold gradient-primary sm:w-auto"
          asChild
        >
          <Link href="/host/earnings">
            View Earnings
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-12 min-w-[180px] rounded-xl border-white/12 bg-white/5 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
          asChild
        >
          <Link href="/host/withdraw">Withdraw Funds</Link>
        </Button>
      </div>
    </HostPageShell>
  );
}
