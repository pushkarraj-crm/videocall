'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart, Search, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminApi,
  type AdminFollowRecord,
  type FollowerAnalytics,
} from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';

export default function AdminFollowersPage() {
  const [records, setRecords] = useState<AdminFollowRecord[]>([]);
  const [stats, setStats] = useState<FollowerAnalytics | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, analytics] = await Promise.all([
        adminApi.followers({
          search: search.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
          limit: 30,
        }),
        adminApi.followerStats(),
      ]);
      setRecords(list.items);
      setTotal(list.total);
      setStats(analytics);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load followers');
    } finally {
      setLoading(false);
    }
  }, [search, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const removeFollow = async (id: string) => {
    try {
      await adminApi.removeFakeFollow(id);
      toast.success('Follow removed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  if (loading && records.length === 0) {
    return <PageLoader label="Loading followers..." />;
  }

  return (
    <div className="premium-glow-bg mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
          <Heart className="h-5 w-5 fill-[#FF2E74] text-[#FF2E74]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Followers</h1>
          <p className="text-sm text-muted-foreground">{total} active follows</p>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
              <p className="text-2xl font-bold">{stats.totalFollows}</p>
              <p className="text-xs text-muted-foreground">Total follows</p>
            </div>
            <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
              <p className="text-2xl font-bold">{stats.followersToday}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
              <p className="text-2xl font-bold">{stats.followersThisMonth}</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </div>
            <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
              <p className="text-2xl font-bold">{stats.averageFollowers}</p>
              <p className="text-xs text-muted-foreground">Avg per host</p>
            </div>
          </div>

          {stats.topHosts.length > 0 && (
            <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-[#FF6B9D]" />
                Most followed hosts
              </h2>
              <div className="flex flex-wrap gap-2">
                {stats.topHosts.slice(0, 5).map((h) => (
                  <span
                    key={h.hostId}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
                  >
                    {h.displayName} · {h.followerCount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="premium-card space-y-3 border-white/8 bg-[#17171C]/90 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search host or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            className="w-auto"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            type="date"
            className="w-auto"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {records.map((row) => (
          <div
            key={row.id}
            className="premium-card flex flex-wrap items-center justify-between gap-3 border-white/8 bg-[#17171C]/90 p-4"
          >
            <div>
              <p className="text-sm text-white">
                <span className="text-muted-foreground">User:</span> {row.user.displayName}
                <span className="mx-2 text-white/20">→</span>
                <span className="text-muted-foreground">Host:</span>{' '}
                {row.host?.displayName ?? row.hostId}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => removeFollow(row.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {records.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No follows found</p>
        )}
      </div>
    </div>
  );
}