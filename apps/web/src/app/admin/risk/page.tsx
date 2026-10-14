'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { riskApi } from '@/lib/api/risk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { cn } from '@/lib/utils';

const RISK_LEVELS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const LEVEL_STYLES: Record<string, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-400',
  MEDIUM: 'bg-amber-500/15 text-amber-400',
  HIGH: 'bg-orange-500/15 text-orange-400',
  CRITICAL: 'bg-red-500/15 text-red-400',
};

type Dashboard = Awaited<ReturnType<typeof riskApi.dashboard>>;
type Analytics = Awaited<ReturnType<typeof riskApi.analytics>>;
type ProfileItem = Awaited<ReturnType<typeof riskApi.list>>['items'][number];

export default function AdminRiskPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState<(typeof RISK_LEVELS)[number]>('');
  const [country, setCountry] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, stats, list] = await Promise.all([
        riskApi.dashboard(),
        riskApi.analytics(),
        riskApi.list({
          search: search.trim() || undefined,
          riskLevel: riskLevel || undefined,
          country: country.trim() || undefined,
          page: 1,
        }),
      ]);
      setDashboard(dash);
      setAnalytics(stats);
      setProfiles(list.items);
      setTotal(list.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load risk dashboard');
    } finally {
      setLoading(false);
    }
  }, [search, riskLevel, country]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !dashboard) {
    return <PageLoader label="Loading risk dashboard..." />;
  }

  return (
    <div className="premium-glow-bg mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
            <ShieldAlert className="h-5 w-5 text-[#FF6B9D]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Risk & Fraud</h1>
            <p className="text-sm text-muted-foreground">
              Anti-fraud detection · {total} monitored profiles
            </p>
          </div>
        </div>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="High Risk" value={dashboard.highRiskAccounts} tone="HIGH" />
          <StatCard label="Medium Risk" value={dashboard.mediumRiskAccounts} tone="MEDIUM" />
          <StatCard label="Critical" value={dashboard.criticalAccounts} tone="CRITICAL" />
          <StatCard
            label="Recent Events"
            value={dashboard.recentEvents.length}
            tone="LOW"
            sub="last 10"
          />
        </div>
      )}

      {analytics && (
        <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Fraud Analytics</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: 'Today', value: analytics.dailyFraudAttempts },
              { label: 'This Week', value: analytics.weeklyFraudAttempts },
              { label: 'This Month', value: analytics.monthlyFraudAttempts },
              { label: 'Referral Abuse', value: analytics.referralAbuse },
              { label: 'Coupon Abuse', value: analytics.couponAbuse },
              { label: 'Recharge Abuse', value: analytics.rechargeAbuse },
              { label: 'Withdrawal Abuse', value: analytics.withdrawalAbuse },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/5 p-3">
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          {analytics.topRiskCountries.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Top countries:</span>
              {analytics.topRiskCountries.map((c) => (
                <span
                  key={c.country}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-xs"
                >
                  {c.country} ({c.count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {dashboard && dashboard.criticalAlerts.length > 0 && (
        <div className="premium-card border-red-500/20 bg-[#17171C]/90 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Critical Alerts</h2>
          </div>
          <div className="space-y-2">
            {dashboard.criticalAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/admin/risk/${alert.userId}`}
                className="flex items-center justify-between rounded-xl bg-red-500/10 px-3 py-2 transition hover:bg-red-500/15"
              >
                <div>
                  <p className="text-sm font-medium">{alert.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.type.replace(/_/g, ' ')} · score {alert.riskScore}
                  </p>
                </div>
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                  CRITICAL
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="premium-card space-y-3 border-white/8 bg-[#17171C]/90 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search user, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value as (typeof RISK_LEVELS)[number])}
          >
            {RISK_LEVELS.map((l) => (
              <option key={l || 'all'} value={l}>
                {l || 'All levels'}
              </option>
            ))}
          </select>
          <Input
            className="w-28"
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted-foreground">
                <th className="pb-2 pr-3">User</th>
                <th className="pb-2 pr-3">Score</th>
                <th className="pb-2 pr-3">Level</th>
                <th className="pb-2 pr-3">Country</th>
                <th className="pb-2 pr-3">Freezes</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.userId} className="border-b border-white/5">
                  <td className="py-3 pr-3">
                    <p className="font-medium">{p.displayName}</p>
                    <p className="text-xs text-muted-foreground">{p.email ?? p.phone}</p>
                  </td>
                  <td className="py-3 pr-3 font-mono">{p.aggregateScore}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        LEVEL_STYLES[p.riskLevel] ?? LEVEL_STYLES.LOW,
                      )}
                    >
                      {p.riskLevel}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{p.lastCountry ?? '—'}</td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {p.freezeWithdrawals && <FreezeBadge label="WD" />}
                      {p.freezeReferralRewards && <FreezeBadge label="REF" />}
                      {p.freezeCouponRedemption && <FreezeBadge label="CPN" />}
                      {p.requireReKyc && <FreezeBadge label="KYC" />}
                    </div>
                  </td>
                  <td className="py-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/risk/${p.userId}`}>Review</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No risk profiles match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dashboard && dashboard.recentEvents.length > 0 && (
        <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent Risk Events</h2>
          <div className="space-y-2">
            {dashboard.recentEvents.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2"
              >
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{e.eventType}</span>
                    <span className="text-muted-foreground"> · {e.reason.slice(0, 80)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">User {e.userId.slice(0, 8)}…</p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    LEVEL_STYLES[e.riskLevel] ?? LEVEL_STYLES.LOW,
                  )}
                >
                  {e.riskScore} · {e.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard && dashboard.topFraudTypes.length > 0 && (
        <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
          <h2 className="mb-3 text-sm font-semibold">Top Fraud Types</h2>
          <div className="flex flex-wrap gap-2">
            {dashboard.topFraudTypes.map((t) => (
              <span key={t.type} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                {t.type.replace(/_/g, ' ')} ({t.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: number;
  tone: string;
  sub?: string;
}) {
  return (
    <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
      <p className={cn('text-2xl font-bold', LEVEL_STYLES[tone]?.split(' ')[1])}>{value}</p>
      <p className="text-xs text-muted-foreground">
        {label}
        {sub ? ` · ${sub}` : ''}
      </p>
    </div>
  );
}

function FreezeBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
      {label}
    </span>
  );
}