'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Mic, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  adminApi,
  type AdminUserListItem,
  type AdminUsersOverview,
} from '@/lib/api/admin';
import { AdminUserActions } from '@/components/admin/admin-user-actions';
import { cn } from '@/lib/utils';

const ONLINE_FILTERS = ['', 'online', 'offline', 'busy'] as const;

function OverviewCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#17171C]/95 to-[#1E1E26]/90 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A7A7B3]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function OnlineBadge({ status }: { status: string | null }) {
  const styles: Record<string, string> = {
    ONLINE: 'bg-emerald-500/15 text-emerald-400',
    OFFLINE: 'bg-white/10 text-white/60',
    BUSY: 'bg-amber-500/15 text-amber-400',
  };
  const label = status ?? 'OFFLINE';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', styles[label] ?? styles.OFFLINE)}>
      {label}
    </span>
  );
}

export default function AdminHostsPage() {
  const [overview, setOverview] = useState<AdminUsersOverview | null>(null);
  const [hosts, setHosts] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [onlineStatus, setOnlineStatus] = useState('');

  const load = useCallback(async () => {
    const res = await adminApi.getUsers({
      q: q || undefined,
      role: 'host',
      onlineStatus: onlineStatus || undefined,
      page,
      limit: 20,
    });
    setOverview(res.overview);
    setHosts(res.items);
    setTotal(res.total);
  }, [q, onlineStatus, page]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load hosts'))
      .finally(() => setLoading(false));
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="premium-glow-bg min-h-full space-y-6 pb-10">
      <header className="flex items-center gap-3">
        <Mic className="h-7 w-7 text-[#FF2E74]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Hosts</h1>
          <p className="text-sm text-[#A7A7B3]">Monitor host availability and profiles</p>
        </div>
      </header>

      {loading && !overview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : overview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard label="Total Hosts" value={overview.totalHosts} />
          <OverviewCard label="Online" value={overview.onlineHosts} />
          <OverviewCard label="Offline" value={overview.offlineHosts} />
          <OverviewCard label="Busy" value={overview.busyHosts} />
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A7A7B3]" />
            <Input
              placeholder="Search host name, phone, email..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="border-white/10 bg-white/5 pl-10"
            />
          </div>
          <Button className="gradient-primary border-0" onClick={() => { setPage(1); load(); }}>
            Search
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ONLINE_FILTERS.map((f) => (
            <Button key={`online-${f}`} size="sm" variant={onlineStatus === f ? 'default' : 'outline'}
              className={onlineStatus === f ? 'gradient-primary border-0' : 'border-white/10'}
              onClick={() => { setOnlineStatus(f); setPage(1); }}>
              {f || 'All'}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#17171C]/90">
        <table className="min-w-[800px] w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-[#A7A7B3]">
            <tr>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Calls</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td>
                </tr>
              ))
            ) : hosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#A7A7B3]">No hosts found</td>
              </tr>
            ) : (
              hosts.map((host) => (
                <tr key={host.id} className="text-white hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={host.avatarUrl ?? undefined} />
                        <AvatarFallback>{host.displayName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{host.displayName}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {host.roles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p>{host.phone ?? '—'}</p>
                    <p className="text-xs text-[#A7A7B3]">{host.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <OnlineBadge status={host.onlineStatus} />
                  </td>
                  <td className="px-4 py-3">{host.totalCalls}</td>
                  <td className="px-4 py-3">
                    {new Date(host.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <AdminUserActions
                      userId={host.id}
                      status={host.status}
                      onChanged={() => void load()}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[#A7A7B3]">{total} hosts · page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/10" disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
          <Button variant="outline" className="border-white/10" disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}