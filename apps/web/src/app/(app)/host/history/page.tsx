'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Phone, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageLoader } from '@/components/shared/page-loader';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterPills } from '@/components/shared/filter-pills';
import { historyApi, type CallHistoryListItem } from '@/lib/api/history';
import {
  CALL_HISTORY_STATUS_LABELS,
  CALL_HISTORY_STATUS_STYLES,
  type CallHistoryDisplayStatus,
} from '@/lib/call-history-status';
import { cn, formatDuration } from '@/lib/utils';

const PERIODS = [
  { key: '', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
];

export default function HostCallHistoryPage() {
  const [items, setItems] = useState<CallHistoryListItem[]>([]);
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await historyApi.hostList({ period: period || undefined });
    setItems(res.items);
  }, [period]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <PageLoader variant="history" />;

  return (
    <div className="premium-glow-bg min-h-full pb-8">
      <header className="border-b border-white/8 px-4 py-5">
        <h1 className="text-xl font-bold text-white">Call History</h1>
        <p className="mt-0.5 text-sm text-[#A7A7B3]">Calls you received as a host</p>
      </header>

      <div className="px-4 pt-4">
        <FilterPills options={PERIODS} value={period} onChange={setPeriod} />
      </div>

      <div className="space-y-3 px-4 pt-4">
        {items.length === 0 ? (
          <div className="premium-card">
            <EmptyState
              icon={Phone}
              title="No calls in this period"
              description="Calls you receive will appear here with duration and earnings."
            />
          </div>
        ) : (
          items.map((call) => {
            const caller = call.caller;
            const status = call.displayStatus as CallHistoryDisplayStatus;
            return (
              <div key={call.id} className="premium-card flex items-center gap-4 p-4">
                <Avatar className="h-12 w-12 border border-white/10">
                  <AvatarImage src={caller?.avatarUrl ?? undefined} />
                  <AvatarFallback>{caller?.displayName?.slice(0, 1) ?? 'U'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{caller?.displayName ?? 'Caller'}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#A7A7B3]">
                    {call.type === 'video' ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDuration(call.durationSeconds)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#A7A7B3]">
                    {new Date(call.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold', CALL_HISTORY_STATUS_STYLES[status])}>
                    {CALL_HISTORY_STATUS_LABELS[status]}
                  </span>
                  {(call.coinsEarned ?? 0) > 0 && (
                    <p className="mt-2 text-sm font-medium text-emerald-400">+{call.coinsEarned} coins</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}