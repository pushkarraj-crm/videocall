'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/page-loader';
import { adminApi } from '@/lib/api/admin';
import {
  CALL_HISTORY_STATUS_LABELS,
  CALL_HISTORY_STATUS_STYLES,
  type CallHistoryDisplayStatus,
} from '@/lib/call-history-status';
import { cn, formatDuration } from '@/lib/utils';

export default function AdminCallDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    adminApi.getCallHistoryDetail(id).then((d) => setDetail(d as Record<string, unknown>));
  }, [id]);

  if (!detail) return <PageLoader label="Loading call record..." />;

  const status = detail.displayStatus as CallHistoryDisplayStatus;

  return (
    <div className="premium-glow-bg min-h-full space-y-4 pb-10">
      <Button variant="outline" size="sm" className="border-white/10" asChild>
        <Link href="/admin/calls"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
      </Button>

      <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Call Record</h1>
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', CALL_HISTORY_STATUS_STYLES[status])}>
            {CALL_HISTORY_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="mt-2 font-mono text-xs text-[#A7A7B3]">{String(detail.callId)}</p>

        <div className="mt-6 space-y-2 text-sm">
          {[
            ['Caller', (detail.caller as { displayName: string })?.displayName],
            ['Host', (detail.host as { displayName: string })?.displayName],
            ['Type', String(detail.type)],
            ['Duration', formatDuration(Number(detail.durationSeconds))],
            ['Coins spent', String(detail.coinsSpent)],
            ['Host earning', String(detail.hostEarning)],
            ['Service commission', String(detail.platformCommission)],
            ['Ended by', String(detail.endedBy ?? '—')],
            ['Started', detail.startedAt ? new Date(String(detail.startedAt)).toLocaleString('en-IN') : '—'],
            ['Ended', detail.endedAt ? new Date(String(detail.endedAt)).toLocaleString('en-IN') : '—'],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between border-b border-white/5 py-2">
              <span className="text-[#A7A7B3]">{label}</span>
              <span className="text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}