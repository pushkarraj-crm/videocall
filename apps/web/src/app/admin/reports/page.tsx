'use client';

import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminReport } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { cn } from '@/lib/utils';
import { REPORT_REASONS } from '@/lib/report-reasons';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'reviewing', label: 'Under review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Rejected' },
];

const RISK_STYLES: Record<string, string> = {
  FLAGGED: 'bg-amber-500/15 text-amber-400',
  HIGH_RISK: 'bg-orange-500/15 text-orange-400',
  RECOMMEND_SUSPENSION: 'bg-red-500/15 text-red-400',
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.reports({
        search: search.trim() || undefined,
        reason: reason || undefined,
        status: status || undefined,
        sort,
        limit: 30,
      });
      setReports(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [search, reason, status, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && reports.length === 0) {
    return <PageLoader label="Loading reports..." />;
  }

  return (
    <div className="premium-glow-bg mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
            <ShieldAlert className="h-5 w-5 text-[#FF6B9D]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-sm text-muted-foreground">{total} total reports</p>
          </div>
        </div>
      </div>

      <div className="premium-card space-y-3 border-white/8 bg-[#17171C]/90 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search reporter, reported user, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">All reasons</option>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button
            variant={sort === 'newest' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSort('newest')}
          >
            Newest
          </Button>
          <Button
            variant={sort === 'oldest' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSort('oldest')}
          >
            Oldest
          </Button>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Apply
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="premium-card p-10 text-center text-muted-foreground">
            No reports match your filters
          </div>
        ) : (
          reports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => router.push(`/admin/reports/${r.id}`)}
              className="premium-card w-full border-white/8 bg-[#17171C]/90 p-4 text-left transition-colors hover:border-white/15"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{r.reasonLabel}</p>
                  <p className="mt-1 text-sm text-[#A7A7B3]">
                    {r.reporter?.displayName ?? 'Reporter'} →{' '}
                    {r.reportedUser?.displayName ?? 'Reported user'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium">
                    {r.displayStatus}
                  </span>
                  {r.riskLevel && r.riskLevel !== 'NONE' && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        RISK_STYLES[r.riskLevel] ?? 'bg-white/10',
                      )}
                    >
                      {r.riskLevel.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
              {r.description && (
                <p className="mt-2 line-clamp-2 text-sm text-[#A7A7B3]">{r.description}</p>
              )}
              <p className="mt-2 text-xs text-[#6B6B78]">
                {new Date(r.createdAt).toLocaleString('en-IN')}
                {r.callId && (
                  <>
                    {' '}
                    ·{' '}
                    <Link
                      href={`/admin/calls`}
                      className="text-[#FF6B9D] hover:underline"
                      onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
                    >
                      Call linked
                    </Link>
                  </>
                )}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
