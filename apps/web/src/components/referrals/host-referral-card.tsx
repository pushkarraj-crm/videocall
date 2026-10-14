'use client';

import Link from 'next/link';
import { Gift, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { HostReferralStats } from '@/lib/api/referral';

interface HostReferralCardProps {
  stats: HostReferralStats;
}

export function HostReferralCard({ stats }: HostReferralCardProps) {
  return (
    <Card className="premium-card overflow-hidden border-white/8 bg-[#17171C]/90">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Gift className="h-4 w-4 text-[#FF2E74]" />
          Referral Earnings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-[20px] border border-white/8 bg-white/5 px-4 py-4">
          <div>
            <p className="text-3xl font-bold text-white">{stats.referralEarnings}</p>
            <p className="text-xs text-[#A7A7B3]">coins earned from referrals</p>
          </div>
          <TrendingUp className="h-8 w-8 text-emerald-400" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[14px] border border-white/8 bg-white/5 p-3">
            <p className="text-lg font-bold text-white">{stats.referralCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Total</p>
          </div>
          <div className="rounded-[14px] border border-white/8 bg-white/5 p-3">
            <p className="text-lg font-bold text-white">{stats.referralsToday}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Today</p>
          </div>
          <div className="rounded-[14px] border border-white/8 bg-white/5 p-3">
            <p className="text-lg font-bold text-white">{stats.referralsThisMonth}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">Month</p>
          </div>
        </div>
        <Button variant="outline" className="w-full border-white/12 bg-white/5 text-white" asChild>
          <Link href="/invite">Invite friends</Link>
        </Button>
      </CardContent>
    </Card>
  );
}