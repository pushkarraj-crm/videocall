'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Phone, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageLoader } from '@/components/shared/page-loader';
import { PageHeader } from '@/components/shared/page-header';
import { Screen } from '@/components/shared/screen';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { historyApi, type CallHistoryListItem } from '@/lib/api/history';
import {
  CALL_HISTORY_STATUS_LABELS,
  CALL_HISTORY_STATUS_STYLES,
  type CallHistoryDisplayStatus,
} from '@/lib/call-history-status';
import { cn, formatDuration } from '@/lib/utils';

export default function UserCallHistoryPage() {
  const [items, setItems] = useState<CallHistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    historyApi.list().then((res) => setItems(res.items)).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader variant="history" />;

  return (
    <Screen className="space-y-4">
      <PageHeader title="Call History" subtitle="Your past calls" icon={<Phone className="h-5 w-5 text-[#FF2E74]" />} />

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="premium-card">
            <EmptyState
              icon={Phone}
              title="No calls yet"
              description="Your call history will appear here after your first conversation."
              action={
                <Button variant="gradient" asChild>
                  <Link href="/home">Discover hosts</Link>
                </Button>
              }
            />
          </div>
        ) : (
          items.map((call) => {
            const host = call.host;
            const status = call.displayStatus as CallHistoryDisplayStatus;
            return (
              <Link
                key={call.id}
                href={`/history/${call.id}`}
                className="premium-card flex items-center gap-4 p-4 transition-transform hover:scale-[1.01]"
              >
                <Avatar className="h-12 w-12 border border-white/10">
                  <AvatarImage src={host?.avatarUrl ?? undefined} />
                  <AvatarFallback>{host?.displayName?.slice(0, 1) ?? 'H'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{host?.displayName ?? 'Host'}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#A7A7B3]">
                    {call.type === 'video' ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                    <span className="capitalize">{call.type}</span>
                    <span>·</span>
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDuration(call.durationSeconds)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#A7A7B3]">
                    {new Date(call.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold', CALL_HISTORY_STATUS_STYLES[status])}>
                    {CALL_HISTORY_STATUS_LABELS[status]}
                  </span>
                  {call.coinsSpent > 0 && (
                    <p className="mt-2 text-sm font-medium text-white">{call.coinsSpent} coins</p>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Screen>
  );
}