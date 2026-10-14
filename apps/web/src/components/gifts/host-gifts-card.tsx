'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, Sparkles } from 'lucide-react';
import { giftsApi } from '@/lib/api/gifts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function HostGiftsCard() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof giftsApi.hostStats>> | null>(null);

  useEffect(() => {
    giftsApi.hostStats().then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  return (
    <Card className="premium-card h-full border-white/8 bg-[#17171C]/95">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Gift className="h-4 w-4 text-[#FF2E74]" />
          Today&apos;s Gifts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/6 bg-white/5 p-3">
            <p className="text-xl font-bold tabular-nums text-white">{stats.todayGifts}</p>
            <p className="text-[10px] uppercase tracking-wide text-[#A7A7B3]">Received</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/5 p-3">
            <p className="text-xl font-bold tabular-nums text-[#FFB347]">{stats.todayCoins}</p>
            <p className="text-[10px] uppercase tracking-wide text-[#A7A7B3]">Coins</p>
          </div>
          <div className="rounded-xl border border-white/6 bg-white/5 p-3">
            <p className="text-xl font-bold tabular-nums text-emerald-400">{stats.todayEarnings}</p>
            <p className="text-[10px] uppercase tracking-wide text-[#A7A7B3]">Earned</p>
          </div>
        </div>
        {stats.mostReceivedGift && (
          <p className="text-sm text-[#A7A7B3]">
            Most received:{' '}
            <span className="text-white">
              {stats.mostReceivedGift.icon} {stats.mostReceivedGift.name} ({stats.mostReceivedGift.count})
            </span>
          </p>
        )}
        {stats.topSender && (
          <p className="text-sm text-[#A7A7B3]">
            Top sender: <span className="text-white">{stats.topSender.displayName}</span>
          </p>
        )}
        {stats.recentGifts[0] && (
          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-[#FFB347]" />
            <span className="text-[#A7A7B3]">Latest:</span>
            <span className="text-white">
              {stats.recentGifts[0].icon} from {stats.recentGifts[0].senderName}
            </span>
          </div>
        )}
        <Link href="/gifts/leaderboard" className="text-xs text-[#FF2E74] hover:underline">
          View gift leaderboard →
        </Link>
      </CardContent>
    </Card>
  );
}