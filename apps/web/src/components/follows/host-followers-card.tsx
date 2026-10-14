'use client';

import { Heart, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HostFollowersSummary } from '@/lib/api/follows';

interface HostFollowersCardProps {
  data: HostFollowersSummary;
}

export function HostFollowersCard({ data }: HostFollowersCardProps) {
  const maxChart = Math.max(...data.dailyChart.map((d) => d.count), 1);

  return (
    <Card className="premium-card overflow-hidden border-white/8 bg-[#17171C]/90">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Heart className="h-4 w-4 fill-[#FF2E74] text-[#FF2E74]" />
          Followers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-[20px] border border-white/8 bg-white/5 px-4 py-4">
          <div>
            <p className="text-3xl font-bold text-white">{data.totalFollowers}</p>
            <p className="text-xs text-[#A7A7B3]">Total followers</p>
          </div>
          {data.growthPercent != null && (
            <div className="flex items-center gap-1 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">{data.growthPercent}%</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
            <p className="text-lg font-bold text-white">{data.followersThisWeek}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">This week</p>
          </div>
          <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
            <p className="text-lg font-bold text-white">{data.followersThisMonth}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">This month</p>
          </div>
          <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
            <p className="text-lg font-bold text-white">{data.repeatUsers}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Repeat users</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#A7A7B3]">
            7-day growth
          </p>
          <div className="flex h-16 items-end gap-1">
            {data.dailyChart.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-[#FF2E74] to-[#FF6B9D] transition-all duration-500"
                  style={{ height: `${Math.max(8, (d.count / maxChart) * 100)}%` }}
                />
                <span className="text-[8px] text-[#A7A7B3]">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        {data.recentFollowers.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#A7A7B3]">
              <Users className="h-3.5 w-3.5" />
              Recent followers
            </p>
            {data.recentFollowers.slice(0, 5).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-[12px] border border-white/8 bg-white/5 px-3 py-2"
              >
                <span className="text-sm text-white">{f.user.displayName}</span>
                <span className="text-xs text-[#A7A7B3]">
                  {new Date(f.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}