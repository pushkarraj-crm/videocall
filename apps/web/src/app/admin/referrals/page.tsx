'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Gift, Search } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type ReferralAnalytics, type AdminReferralRecord } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { cn } from '@/lib/utils';

const STATUSES = ['', 'PENDING', 'COMPLETED', 'REWARDED', 'CANCELLED'] as const;

export default function AdminReferralsPage() {
  const [records, setRecords] = useState<AdminReferralRecord[]>([]);
  const [analytics, setAnalytics] = useState<ReferralAnalytics | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.referrals({
        search: search.trim() || undefined,
        status: status || undefined,
        limit: 30,
      });
      setRecords(res.items);
      setTotal(res.total);
      setAnalytics(res.analytics);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const reward = async (referralId: string) => {
    try {
      await adminApi.rewardReferral(referralId);
      toast.success('Reward issued');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reward failed');
    }
  };

  const cancel = async (referralId: string) => {
    try {
      await adminApi.cancelReferral(referralId, 'Cancelled by admin');
      toast.success('Referral cancelled');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    }
  };

  if (loading && records.length === 0) {
    return <PageLoader label="Loading referrals..." />;
  }

  return (
    <div className="premium-glow-bg mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
            <Gift className="h-5 w-5 text-[#FF6B9D]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Referrals</h1>
            <p className="text-sm text-muted-foreground">{total} total records</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const csv = await adminApi.exportReferralsCsv({
                search: search.trim() || undefined,
                status: status || undefined,
              });
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `referrals-${Date.now()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('CSV exported');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Export failed');
            }
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.totalReferrals}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.successfulReferrals}</p>
            <p className="text-xs text-muted-foreground">Rewarded</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Conversion</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.rewardAmountCoins}</p>
            <p className="text-xs text-muted-foreground">Coins rewarded</p>
          </div>
        </div>
      )}

      <div className="premium-card space-y-3 border-white/8 bg-[#17171C]/90 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search code, referrer, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-lg border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {records.map((row) => (
          <div
            key={row.id}
            className="premium-card flex flex-wrap items-center justify-between gap-3 border-white/8 bg-[#17171C]/90 p-4"
          >
            <div>
              <p className="font-mono text-sm text-[#FF6B9D]">{row.referralCode}</p>
              <p className="mt-1 text-sm text-white">
                {row.referrer?.displayName ?? row.referrerId} →{' '}
                {row.referredUser?.displayName ?? row.referredUserId}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  row.displayStatus === 'REWARDED' && 'bg-emerald-500/15 text-emerald-400',
                  row.displayStatus === 'PENDING' && 'bg-amber-500/15 text-amber-400',
                  row.displayStatus === 'COMPLETED' && 'bg-sky-500/15 text-sky-400',
                  row.displayStatus === 'CANCELLED' && 'bg-red-500/15 text-red-400',
                )}
              >
                {row.displayStatus}
              </span>
              {row.displayStatus !== 'REWARDED' && row.displayStatus !== 'CANCELLED' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => reward(row.id)}>
                    Reward
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => cancel(row.id)}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}