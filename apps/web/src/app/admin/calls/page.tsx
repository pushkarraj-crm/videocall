'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/lib/api/admin';
import {
  CALL_HISTORY_STATUS_LABELS,
  CALL_HISTORY_STATUS_STYLES,
  type CallHistoryDisplayStatus,
} from '@/lib/call-history-status';
import { cn, formatDuration } from '@/lib/utils';

const STATUS_FILTERS = ['', 'completed', 'missed', 'rejected', 'cancelled', 'failed'];

export default function AdminCallsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.getCallHistory>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const res = await adminApi.getCallHistory({ q: q || undefined, status: status || undefined, page });
    setData(res);
  }, [q, status, page]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const analytics = data?.analytics;

  return (
    <div className="premium-glow-bg min-h-full space-y-6 pb-10">
      <header className="flex items-center gap-3">
        <Phone className="h-7 w-7 text-[#FF2E74]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Call Records</h1>
          <p className="text-sm text-[#A7A7B3]">Read-only call history & analytics</p>
        </div>
      </header>

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total Calls', value: analytics.totalCalls },
            { label: 'Completed', value: analytics.completedCalls },
            { label: 'Missed', value: analytics.missedCalls },
            { label: 'Rejected', value: analytics.rejectedCalls },
            { label: 'Avg Duration', value: `${analytics.averageDurationSeconds}s` },
            { label: 'Avg Revenue', value: `${analytics.averageRevenueCoins} coins` },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4">
              <p className="text-xs uppercase tracking-wider text-[#A7A7B3]">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A7A7B3]" />
            <Input placeholder="Caller, host, call ID..." value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="border-white/10 bg-white/5 pl-10" />
          </div>
          <Button className="gradient-primary border-0" onClick={() => { setPage(1); load(); }}>Search</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button key={f} size="sm" variant={status === f ? 'default' : 'outline'}
              className={status === f ? 'gradient-primary border-0' : 'border-white/10'}
              onClick={() => { setStatus(f); setPage(1); }}>
              {f || 'All'}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#17171C]/90">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-[#A7A7B3]">
            <tr>
              <th className="px-4 py-3">Caller</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Coins</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td></tr>
              ))
            ) : !data?.items.length ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-[#A7A7B3]">No call records</td></tr>
            ) : (
              data.items.map((call) => {
                const display = call.displayStatus as CallHistoryDisplayStatus;
                return (
                  <tr key={call.id} className="text-white">
                    <td className="px-4 py-3">{call.caller.displayName}</td>
                    <td className="px-4 py-3">{call.host.displayName}</td>
                    <td className="px-4 py-3 capitalize">{call.type}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', CALL_HISTORY_STATUS_STYLES[display])}>
                        {CALL_HISTORY_STATUS_LABELS[display]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDuration(call.durationSeconds)}</td>
                    <td className="px-4 py-3">{call.coinsSpent}</td>
                    <td className="px-4 py-3">{new Date(call.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" className="border-white/10"
                        onClick={() => router.push(`/admin/calls/${call.id}`)}>Details</Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex justify-between text-sm text-[#A7A7B3]">
          <span>{data.total} records</span>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10" disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" className="border-white/10" disabled={page * data.limit >= data.total}
              onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}