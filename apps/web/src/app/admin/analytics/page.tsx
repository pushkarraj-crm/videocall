'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  ArrowDownToLine,
  BarChart3,
  CalendarRange,
  Download,
  IndianRupee,
  Phone,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { AnalyticsTrendChart } from '@/components/admin/analytics-trend-chart';
import {
  adminApi,
  type AnalyticsDashboard,
  type AnalyticsPeriod,
} from '@/lib/api/admin';
import { cn, formatInr } from '@/lib/utils';

const PERIOD_FILTERS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: 'custom', label: 'Custom' },
];

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#17171C]/95 to-[#1E1E26]/90 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A7A7B3]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-[#A7A7B3]">{sub}</p>}
        </div>
        <div
          className={cn(
            'rounded-xl p-2.5',
            accent ?? 'bg-[#FF2E74]/15 text-[#FF2E74]',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
      {children}
    </h2>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const dashboard = await adminApi.getAnalyticsDashboard({
      period,
      from: period === 'custom' ? customFrom || undefined : undefined,
      to: period === 'custom' ? customTo || undefined : undefined,
    });
    setData(dashboard);
  }, [period, customFrom, customTo]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [load]);

  const downloadCsv = async (type: 'revenue' | 'hosts' | 'withdrawals') => {
    setExporting(type);
    try {
      const csv = await adminApi.exportAnalyticsCsv({
        type,
        period,
        from: period === 'custom' ? customFrom || undefined : undefined,
        to: period === 'custom' ? customTo || undefined : undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${type}-${period}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${type} report exported`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  if (loading || !data) return <PageLoader variant="admin" />;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="premium-glow-bg min-h-full space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[#FF2E74]" />
            <h1 className="text-2xl font-bold text-white">Revenue Analytics</h1>
          </div>
          <p className="mt-1 text-sm text-[#A7A7B3]">
            Business metrics · {new Date(data.period.from).toLocaleDateString('en-IN')} –{' '}
            {new Date(data.period.to).toLocaleDateString('en-IN')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={period === f.key ? 'default' : 'outline'}
              className={cn(
                period === f.key
                  ? 'gradient-primary border-0 text-white'
                  : 'border-white/10 bg-white/5 text-[#A7A7B3] hover:bg-white/10',
              )}
              onClick={() => setPeriod(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </header>

      {period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <label className="text-xs text-[#A7A7B3]">From</label>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 border-white/10 bg-[#17171C]"
            />
          </div>
          <div>
            <label className="text-xs text-[#A7A7B3]">To</label>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 border-white/10 bg-[#17171C]"
            />
          </div>
          <Button className="gradient-primary border-0" onClick={() => load()}>
            <CalendarRange className="mr-2 h-4 w-4" />
            Apply
          </Button>
        </div>
      )}

      <section className="space-y-3">
        <SectionTitle>Top Metrics</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Today Revenue" value={formatInr(data.revenue.todayInr)} icon={IndianRupee} />
          <MetricCard label="This Week" value={formatInr(data.revenue.weekInr)} icon={TrendingUp} accent="bg-emerald-500/15 text-emerald-400" />
          <MetricCard label="This Month" value={formatInr(data.revenue.monthInr)} icon={Activity} accent="bg-amber-500/15 text-amber-400" />
          <MetricCard label="Total Revenue" value={formatInr(data.revenue.totalInr)} icon={Wallet} />
          <MetricCard label="Total Withdrawals" value={formatInr(data.revenue.totalWithdrawalsInr)} icon={ArrowDownToLine} accent="bg-orange-500/15 text-orange-400" />
          <MetricCard label="Net Profit" value={formatInr(data.revenue.platformProfitInr)} icon={BarChart3} accent="bg-violet-500/15 text-violet-400" />
          <MetricCard label="Total Recharges" value={formatInr(data.revenue.totalRechargesInr)} icon={IndianRupee} />
          <MetricCard
            label="Period Revenue"
            value={formatInr(data.revenue.periodTotalInr)}
            sub={`Recharge ${formatInr(data.revenue.periodRechargeInr)} + Fees ${formatInr(data.revenue.periodPlatformFeesInr)}`}
            icon={TrendingUp}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="space-y-3 xl:col-span-1">
          <SectionTitle>User Metrics</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MetricCard label="Total Users" value={String(data.users.totalUsers)} icon={Users} />
            <MetricCard label="Active Today" value={String(data.users.activeUsersToday)} icon={Activity} />
            <MetricCard label="New Today" value={String(data.users.newUsersToday)} icon={Users} accent="bg-sky-500/15 text-sky-400" />
            <MetricCard label="Total Hosts" value={String(data.users.totalHosts)} icon={Users} />
            <MetricCard label="Verified Hosts" value={String(data.users.verifiedHosts)} icon={Users} accent="bg-emerald-500/15 text-emerald-400" />
            <MetricCard label="Online Hosts" value={String(data.users.onlineHosts)} icon={Activity} accent="bg-green-500/15 text-green-400" />
            <MetricCard label="Busy Hosts" value={String(data.users.busyHosts)} icon={Phone} accent="bg-amber-500/15 text-amber-400" />
          </div>
        </section>

        <section className="space-y-3 xl:col-span-2">
          <SectionTitle>Call & Recharge Metrics</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Calls Today" value={String(data.calls.today)} icon={Phone} />
            <MetricCard label="Calls This Week" value={String(data.calls.week)} icon={Phone} />
            <MetricCard label="Calls This Month" value={String(data.calls.month)} icon={Phone} />
            <MetricCard label="Total Calls" value={String(data.calls.total)} icon={Phone} />
            <MetricCard label="Total Minutes" value={String(data.calls.totalMinutes)} icon={Activity} />
            <MetricCard label="Avg Duration" value={formatDuration(data.calls.avgDurationSeconds)} icon={Activity} />
            <MetricCard label="Revenue / Call" value={formatInr(data.calls.revenuePerCallInr)} icon={IndianRupee} />
            <MetricCard label="Recharge Count" value={String(data.recharges.count)} icon={Wallet} />
            <MetricCard label="Recharge Amount" value={formatInr(data.recharges.amountInr)} icon={IndianRupee} />
            <MetricCard label="Avg Recharge" value={formatInr(data.recharges.avgInr)} icon={TrendingUp} />
            <MetricCard
              label="Top Package"
              value={data.recharges.topPackage?.name ?? '—'}
              sub={
                data.recharges.topPackage
                  ? `${data.recharges.topPackage.count} sales · ${formatInr(data.recharges.topPackage.amountInr)}`
                  : undefined
              }
              icon={Wallet}
            />
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <SectionTitle>Withdrawal Metrics</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Pending" value={String(data.withdrawals.pending)} icon={ArrowDownToLine} accent="bg-amber-500/15 text-amber-400" />
          <MetricCard label="Approved" value={String(data.withdrawals.approved)} icon={ArrowDownToLine} />
          <MetricCard label="Paid" value={String(data.withdrawals.paid)} icon={ArrowDownToLine} accent="bg-emerald-500/15 text-emerald-400" />
          <MetricCard label="Rejected" value={String(data.withdrawals.rejected)} icon={ArrowDownToLine} accent="bg-red-500/15 text-red-400" />
          <MetricCard label="Total Withdrawn" value={formatInr(data.withdrawals.totalWithdrawnInr)} icon={IndianRupee} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Revenue Trend</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AnalyticsTrendChart
              title="Daily Revenue"
              subtitle="Recharge + platform fees"
              data={data.trend.map((row) => ({ date: row.date, value: row.revenueInr }))}
            />
          </div>
          <AnalyticsTrendChart
            title="Daily Calls"
            data={data.trend.map((row) => ({ date: row.date, value: row.calls }))}
            valueLabel={(v) => String(v)}
            accentClass="from-sky-500 to-cyan-400"
          />
          <AnalyticsTrendChart
            title="Daily Recharges"
            data={data.trend.map((row) => ({ date: row.date, value: row.recharges }))}
            valueLabel={(v) => String(v)}
            accentClass="from-violet-500 to-purple-400"
          />
          <div className="lg:col-span-2">
            <AnalyticsTrendChart
              title="Daily Recharge Amount"
              data={data.trend.map((row) => ({ date: row.date, value: row.rechargeInr }))}
              accentClass="from-emerald-500 to-teal-400"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <SectionTitle>Top 10 Hosts</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/90">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-[#A7A7B3]">
                <tr>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Calls</th>
                  <th className="px-4 py-3">Min</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Withdrawn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.topHosts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#A7A7B3]">
                      No host data for this period
                    </td>
                  </tr>
                ) : (
                  data.topHosts.map((host) => (
                    <tr key={host.hostId} className="text-white">
                      <td className="px-4 py-3 font-medium">{host.name}</td>
                      <td className="px-4 py-3">{host.calls}</td>
                      <td className="px-4 py-3">{host.minutes}</td>
                      <td className="px-4 py-3">{formatInr(host.revenueInr)}</td>
                      <td className="px-4 py-3">{formatInr(host.withdrawnInr)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Top 10 Paying Users</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/90">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-[#A7A7B3]">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Recharge</th>
                  <th className="px-4 py-3">Calls</th>
                  <th className="px-4 py-3">Min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.topUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[#A7A7B3]">
                      No recharge data for this period
                    </td>
                  </tr>
                ) : (
                  data.topUsers.map((user) => (
                    <tr key={user.userId} className="text-white">
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3">{formatInr(user.rechargeInr)}</td>
                      <td className="px-4 py-3">{user.calls}</td>
                      <td className="px-4 py-3">{user.minutes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <SectionTitle>Export Reports</SectionTitle>
        <div className="flex flex-wrap gap-3">
          {(['revenue', 'hosts', 'withdrawals'] as const).map((type) => (
            <Button
              key={type}
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={exporting === type}
              onClick={() => downloadCsv(type)}
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting === type ? 'Exporting…' : `Export ${type} CSV`}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}