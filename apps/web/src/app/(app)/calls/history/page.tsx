'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Clock } from 'lucide-react';
import { callsApi } from '@/lib/api/calls';
import { PageLoader } from '@/components/shared/page-loader';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';

interface CallHistoryItem {
  id: string;
  status: string;
  durationSeconds?: number;
  isFreeCall?: boolean;
  coinsChargedUnits?: string;
  createdAt: string;
  caller?: { id: string; displayName: string; avatarUrl?: string | null };
  callee?: { id: string; displayName: string; avatarUrl?: string | null };
}

export default function CallHistoryPage() {
  const [items, setItems] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callsApi
      .history()
      .then((res) => setItems(res.items as CallHistoryItem[]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">Call History</h1>
      {items.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No calls yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((call) => {
            const other = call.callee ?? call.caller;
            return (
              <Link
                key={call.id}
                href={other ? `/profiles/${other.id}` : '#'}
                className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{other?.displayName ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(call.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {call.durationSeconds != null && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(call.durationSeconds)}
                    </span>
                  )}
                  {call.isFreeCall ? (
                    <Badge variant="success" className="mt-1">Free</Badge>
                  ) : call.coinsChargedUnits && call.coinsChargedUnits !== '0' ? (
                    <p className="text-xs text-muted-foreground">
                      {Number(call.coinsChargedUnits) / 100} coins
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}