'use client';

import { useEffect, useState } from 'react';
import { Crown, Gift, Trophy } from 'lucide-react';
import { giftsApi } from '@/lib/api/gifts';
import { PageLoader } from '@/components/shared/page-loader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const PERIODS = ['daily', 'weekly', 'monthly', 'all_time'] as const;

export default function GiftLeaderboardPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('weekly');
  const [data, setData] = useState<Awaited<ReturnType<typeof giftsApi.leaderboard>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    giftsApi
      .leaderboard(period)
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading || !data) return <PageLoader variant="generic" />;

  return (
    <div className="premium-glow-bg min-h-dvh px-4 pb-24 pt-6">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-[#FFB347]" />
          <h1 className="text-2xl font-bold text-white">Gift Leaderboard</h1>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize',
                period === p ? 'gradient-primary text-white' : 'bg-white/5 text-[#A7A7B3]',
              )}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
            <Gift className="h-4 w-4" /> Top Gifters
          </h2>
          <ul className="space-y-2">
            {data.topGifters.map((row) => (
              <li key={row.rank} className="premium-card flex items-center gap-3 p-3">
                <span className="w-6 text-center font-bold text-[#FFB347]">#{row.rank}</span>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={row.user?.avatarUrl ?? undefined} />
                  <AvatarFallback>{row.user?.displayName?.[0] ?? '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate text-white">{row.user?.displayName ?? 'Unknown'}</div>
                <div className="text-right text-sm">
                  <p className="font-bold text-[#FFB347]">{row.totalCoins}</p>
                  <p className="text-[10px] text-[#A7A7B3]">{row.giftCount} gifts</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
            <Crown className="h-4 w-4" /> Top Hosts
          </h2>
          <ul className="space-y-2">
            {data.topHosts.map((row) => (
              <li key={row.rank} className="premium-card flex items-center gap-3 p-3">
                <span className="w-6 text-center font-bold text-[#FF2E74]">#{row.rank}</span>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={row.user?.avatarUrl ?? undefined} />
                  <AvatarFallback>{row.user?.displayName?.[0] ?? '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate text-white">{row.user?.displayName ?? 'Unknown'}</div>
                <div className="text-right text-sm">
                  <p className="font-bold text-emerald-400">{row.totalEarnings}</p>
                  <p className="text-[10px] text-[#A7A7B3]">{row.giftCount} gifts</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}