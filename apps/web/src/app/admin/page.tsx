'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/page-loader';
import { formatInr } from '@/lib/utils';
import { typography } from '@/lib/design-tokens';

interface PlatformRevenue {
  rechargeRevenueInr: number;
  platformFeeInr: number;
  totalRevenueInr: number;
  availableRevenueInr: number;
  withdrawnInr: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    adminApi.analytics().then((d) => setStats(d as Record<string, unknown>));
  }, []);

  if (!stats) return <PageLoader variant="admin" />;

  const revenue = stats.platformRevenue as PlatformRevenue;

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers },
    { label: 'Active Hosts', value: stats.activeHosts },
    { label: 'Calls Today', value: stats.callsToday },
    { label: 'Revenue Today', value: formatInr(Number(stats.revenueTodayInr)) },
  ];

  const revenueCards = [
    { label: 'Total Revenue', value: formatInr(revenue.totalRevenueInr), sub: `Recharge ${formatInr(revenue.rechargeRevenueInr)} + Fees ${formatInr(revenue.platformFeeInr)}` },
    { label: 'Available Revenue', value: formatInr(revenue.availableRevenueInr), highlight: true },
    { label: 'Withdrawn', value: formatInr(revenue.withdrawnInr) },
    { label: 'Service Fees', value: formatInr(revenue.platformFeeInr), sub: 'From calls & gifts' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page-title text-2xl">Dashboard</h1>
        <p className={typography.pageSubtitle}>Overview and revenue</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} className="premium-card border-white/8 transition-transform hover:scale-[1.01]">
            <CardHeader className="pb-1">
              <CardTitle className={typography.label}>{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={typography.stat}>{String(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className={typography.sectionTitle}>Revenue</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {revenueCards.map((s) => (
            <Card key={s.label} className="premium-card border-white/8">
              <CardHeader className="pb-1">
                <CardTitle className={typography.label}>{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={s.highlight ? 'text-2xl font-bold text-emerald-400' : typography.stat}>
                  {s.value}
                </p>
                {s.sub && <p className={typography.caption}>{s.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}