'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Phone, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/page-loader';
import { ReportUserDialog } from '@/components/reports/report-user-dialog';
import { historyApi, type CallHistoryDetail } from '@/lib/api/history';
import { useAuthStore } from '@/stores/auth-store';
import {
  CALL_HISTORY_STATUS_LABELS,
  CALL_HISTORY_STATUS_STYLES,
  type CallHistoryDisplayStatus,
} from '@/lib/call-history-status';
import { cn, formatDuration } from '@/lib/utils';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 text-sm">
      <span className="text-[#A7A7B3]">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

export default function CallHistoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [detail, setDetail] = useState<CallHistoryDetail | null>(null);
  const userId = useAuthStore((s) => s.session?.user?.id);

  useEffect(() => {
    historyApi.get(id).then(setDetail);
  }, [id]);

  if (!detail) return <PageLoader label="Loading call details..." />;

  const status = detail.displayStatus as CallHistoryDisplayStatus;
  const reportTarget =
    userId === detail.caller.id
      ? { id: detail.host.id, name: detail.host.displayName }
      : userId === detail.host.id
        ? { id: detail.caller.id, name: detail.caller.displayName }
        : { id: detail.host.id, name: detail.host.displayName };

  return (
    <div className="premium-glow-bg min-h-full pb-8">
      <header className="border-b border-white/8 px-4 py-5">
        <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-[#A7A7B3]" asChild>
          <Link href="/history"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
        </Button>
        <h1 className="text-xl font-bold text-white">Call Details</h1>
        <p className="mt-1 font-mono text-xs text-[#A7A7B3]">{detail.callId}</p>
      </header>

      <div className="space-y-4 px-4 pt-5">
        <div className="premium-card p-5">
          <div className="flex items-center justify-between">
            <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', CALL_HISTORY_STATUS_STYLES[status])}>
              {CALL_HISTORY_STATUS_LABELS[status]}
            </span>
            <div className="flex items-center gap-1 text-sm text-[#A7A7B3]">
              {detail.type === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              <span className="capitalize">{detail.type}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="text-center">
              <Avatar className="mx-auto h-14 w-14">
                <AvatarImage src={detail.host.avatarUrl ?? undefined} />
                <AvatarFallback>{detail.host.displayName.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <p className="mt-2 text-sm font-medium text-white">{detail.host.displayName}</p>
              <p className="text-xs text-[#A7A7B3]">Host</p>
            </div>
            <div className="text-center">
              <Avatar className="mx-auto h-14 w-14">
                <AvatarImage src={detail.caller.avatarUrl ?? undefined} />
                <AvatarFallback>{detail.caller.displayName.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <p className="mt-2 text-sm font-medium text-white">{detail.caller.displayName}</p>
              <p className="text-xs text-[#A7A7B3]">Caller</p>
            </div>
          </div>
        </div>

        <div className="premium-card px-4 py-2">
          <DetailRow label="Started" value={detail.startedAt ? new Date(detail.startedAt).toLocaleString('en-IN') : '—'} />
          <DetailRow label="Ended" value={detail.endedAt ? new Date(detail.endedAt).toLocaleString('en-IN') : '—'} />
          <DetailRow label="Duration" value={formatDuration(detail.durationSeconds)} />
          <DetailRow label="Coins spent" value={String(detail.coinsSpent)} />
          <DetailRow label="Ended by" value={detail.endedBy ?? '—'} />
        </div>

        <p className="text-center text-xs text-[#A7A7B3]">Metadata only — no recording or playback</p>

        <ReportUserDialog
          reportedUserId={reportTarget.id}
          reportedUserName={reportTarget.name}
          callId={detail.callId}
          className="w-full"
        />
      </div>
    </div>
  );
}