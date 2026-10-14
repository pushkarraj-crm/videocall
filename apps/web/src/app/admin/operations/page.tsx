'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  Bot,
  Download,
  Headphones,
  IndianRupee,
  Phone,
  Radio,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/page-loader';
import { AnalyticsTrendChart } from '@/components/admin/analytics-trend-chart';
import {
  adminApi,
  type AnalyticsPeriod,
  type OperationsOverview,
} from '@/lib/api/admin';
import { cn, formatInr } from '@/lib/utils';

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
];

function Metric({
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
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#17171C]/95 to-[#1E1E26]/90 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A7A7B3]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-[#A7A7B3]">{sub}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5', accent ?? 'bg-[#FF2E74]/15 text-[#FF2E74]')}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function OperationsPanelPage() {
  const [data, setData] = useState<OperationsOverview | null>(null);
  const [liveCalls, setLiveCalls] = useState<Record<string, unknown>[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown> | null>(null);
  const [support, setSupport] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<Record<string, unknown> | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [overview, calls, pay, sup, log] = await Promise.all([
      adminApi.getOperationsOverview({ period }),
      adminApi.getOperationsLiveCalls(10),
      adminApi.getOperationsPayments({ limit: 8 }),
      adminApi.getOperationsSupport({ limit: 6 }),
      adminApi.getOperationsLogs({ type: 'all', limit: 12 }),
    ]);
    setData(overview);
    setLiveCalls(calls as Record<string, unknown>[]);
    setPayments(pay as Record<string, unknown>);
    setSupport(sup as Record<string, unknown>);
    setLogs(log as Record<string, unknown>);
  }, [period]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load operations'))
      .finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
      toast.success('Operations data refreshed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const exportReport = async (report: string, format: 'csv' | 'excel' = 'csv') => {
    try {
      const csv = await adminApi.exportOperationsReport({ report, period, format });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `operations-${report}-${period}.${format === 'excel' ? 'xls' : 'csv'}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  if (loading || !data) return <PageLoader variant="admin" label="Loading operations..." />;

  const paymentItems = (payments?.items as Record<string, unknown>[]) ?? [];
  const supportItems = (support?.items as Record<string, unknown>[]) ?? [];
  const logItems = (logs?.items as Record<string, unknown>[]) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Operations Panel</h1>
          <p className="text-sm text-[#A7A7B3]">
            Enterprise dashboard · Updated {new Date(data.updatedAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? 'gradient' : 'outline'}
              className={period !== p.key ? 'border-white/12 bg-white/5 text-white' : ''}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" loading={refreshing} onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a) => (
            <div
              key={a.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm',
                a.severity === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  : 'border-blue-500/20 bg-blue-500/10 text-blue-200',
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total Revenue" value={formatInr(data.revenue.totalInr)} icon={IndianRupee} />
        <Metric label="Today's Revenue" value={formatInr(data.revenue.todayInr)} icon={Activity} accent="bg-emerald-500/15 text-emerald-400" />
        <Metric label="Monthly Revenue" value={formatInr(data.revenue.monthlyInr)} icon={IndianRupee} accent="bg-violet-500/15 text-violet-400" />
        <Metric label="Period Revenue" value={formatInr(data.revenue.periodInr)} icon={IndianRupee} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Active Calls" value={String(data.live.activeCalls)} icon={Phone} />
        <Metric label="AI Host Calls" value={String(data.live.activeAiHosts)} icon={Bot} />
        <Metric label="Real Host Calls" value={String(data.live.activeRealHosts)} icon={Radio} />
        <Metric label="Online Users" value={String(data.live.onlineUsers)} icon={Users} />
        <Metric label="Online Hosts" value={String(data.live.onlineHosts)} sub={`${data.live.busyHosts} busy`} icon={Headphones} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsTrendChart title="Revenue Trend" data={data.charts.revenue.map((r) => ({ date: r.date, value: r.value }))} />
        <AnalyticsTrendChart
          title="Daily Calls"
          data={data.charts.dailyCalls}
          valueLabel={(v) => String(v)}
          accentClass="from-violet-500 to-purple-400"
        />
        <AnalyticsTrendChart
          title="Coin Usage"
          data={data.charts.coinUsage}
          valueLabel={(v) => `${(v / 100).toFixed(0)} coins`}
          accentClass="from-amber-500 to-orange-400"
        />
        <AnalyticsTrendChart
          title="Recharges"
          data={data.charts.recharges.map((r) => ({ date: r.date, value: r.amountInr }))}
          accentClass="from-emerald-500 to-teal-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-5 lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">Host Status</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[#A7A7B3]">Online</dt><dd className="text-lg font-bold text-emerald-400">{data.hosts.online}</dd></div>
            <div><dt className="text-[#A7A7B3]">Offline</dt><dd className="text-lg font-bold">{data.hosts.offline}</dd></div>
            <div><dt className="text-[#A7A7B3]">Busy</dt><dd className="text-lg font-bold text-amber-400">{data.hosts.busy}</dd></div>
            <div><dt className="text-[#A7A7B3]">Real</dt><dd className="text-lg font-bold">{data.hosts.real}</dd></div>
            <div><dt className="text-[#A7A7B3]">AI</dt><dd className="text-lg font-bold">{data.hosts.ai}</dd></div>
            <div><dt className="text-[#A7A7B3]">Managed</dt><dd className="text-lg font-bold">{data.hosts.managed}</dd></div>
          </dl>
          <Button variant="outline" size="sm" className="mt-4 w-full border-white/12" asChild>
            <Link href="/admin/users?role=host">Manage hosts</Link>
          </Button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">Live Calls</h2>
            <Link href="/admin/calls" className="text-xs text-[#FF6B9D] hover:underline">View all</Link>
          </div>
          {liveCalls.length === 0 ? (
            <p className="text-sm text-[#A7A7B3]">No active calls</p>
          ) : (
            <div className="space-y-2">
              {liveCalls.map((c) => (
                <div key={String(c.id)} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-white">
                    {(c.caller as { displayName?: string })?.displayName} → {(c.host as { displayName?: string })?.displayName}
                  </span>
                  <span className="text-[#A7A7B3]">{String(c.status)} · {String(c.hostCallType ?? '—')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
            <ShieldAlert className="h-4 w-4" /> Fraud Detection
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[#A7A7B3]">Multi-account</dt><dd className="font-bold text-amber-400">{data.fraud.multipleAccounts}</dd></div>
            <div><dt className="text-[#A7A7B3]">Wallet abuse</dt><dd className="font-bold">{data.fraud.rechargeAbuse}</dd></div>
            <div><dt className="text-[#A7A7B3]">Call fraud</dt><dd className="font-bold">{data.fraud.callSpam}</dd></div>
            <div><dt className="text-[#A7A7B3]">Failed payments (24h)</dt><dd className="font-bold">{data.fraud.repeatedFailures24h}</dd></div>
            <div><dt className="text-[#A7A7B3]">Suspicious IP (7d)</dt><dd className="font-bold">{data.fraud.suspiciousIp7d}</dd></div>
            <div><dt className="text-[#A7A7B3]">Open flags</dt><dd className="font-bold text-red-400">{data.fraud.openFlags}</dd></div>
          </dl>
          <Button variant="outline" size="sm" className="mt-4 border-white/12" asChild>
            <Link href="/admin/risk">Risk console</Link>
          </Button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">Top Hosts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-[#FF6B9D]">AI Hosts</p>
              {data.topAiHosts.slice(0, 5).map((h) => (
                <div key={h.hostId} className="flex justify-between py-1 text-sm">
                  <span className="truncate text-white">{h.name}</span>
                  <span className="text-[#A7A7B3]">{h.calls} calls</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-emerald-400">Real Hosts</p>
              {data.topRealHosts.slice(0, 5).map((h) => (
                <div key={h.hostId} className="flex justify-between py-1 text-sm">
                  <span className="truncate text-white">{h.name}</span>
                  <span className="text-[#A7A7B3]">{h.calls} calls</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">Payments</h2>
            <Link href="/admin/revenue" className="text-xs text-[#FF6B9D] hover:underline">Revenue</Link>
          </div>
          {paymentItems.map((p) => (
            <div key={String(p.id)} className="flex justify-between border-b border-white/5 py-2 text-sm last:border-0">
              <span className="text-white">{String(p.userName)}</span>
              <span className={p.status === 'paid' ? 'text-emerald-400' : p.status === 'failed' ? 'text-red-400' : 'text-[#A7A7B3]'}>
                {String(p.status)} · ₹{Number(p.totalInr)}
              </span>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">Support Tickets</h2>
            <span className="text-xs text-amber-400">{Number(support?.openCount ?? 0)} open</span>
          </div>
          {supportItems.map((t) => (
            <div key={String(t.id)} className="border-b border-white/5 py-2 text-sm last:border-0">
              <p className="font-medium text-white">{String(t.subject)}</p>
              <p className="text-xs text-[#A7A7B3]">{String(t.status)} · {String(t.userName)}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">Recent Logs</h2>
        <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
          {logItems.map((l) => (
            <div key={String(l.id)} className="flex gap-3 text-[#A7A7B3]">
              <span className="shrink-0 text-[#FF6B9D]">{String(l.type)}</span>
              <span className="truncate">{String(l.action)}</span>
              <span className="ml-auto shrink-0">{new Date(String(l.createdAt)).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="border-white/12" onClick={() => exportReport('revenue', 'csv')}>
          <Download className="mr-2 h-4 w-4" /> Revenue CSV
        </Button>
        <Button variant="outline" size="sm" className="border-white/12" onClick={() => exportReport('calls', 'csv')}>
          <Download className="mr-2 h-4 w-4" /> Calls CSV
        </Button>
        <Button variant="outline" size="sm" className="border-white/12" onClick={() => exportReport('payments', 'excel')}>
          <Download className="mr-2 h-4 w-4" /> Payments Excel
        </Button>
        <Button variant="outline" size="sm" className="border-white/12" asChild>
          <Link href="/admin/withdrawals">Withdrawal queue ({data.withdrawals.pending})</Link>
        </Button>
        <Button variant="outline" size="sm" className="border-white/12" asChild>
          <Link href="/admin/analytics">Full analytics</Link>
        </Button>
      </div>
    </div>
  );
}