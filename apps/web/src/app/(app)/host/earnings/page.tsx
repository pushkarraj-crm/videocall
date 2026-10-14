'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  Clock,
  IndianRupee,
  Phone,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { hostsApi, type EarningHistoryItem, type EarningsSummary } from '@/lib/api/hosts';
import { PageLoader } from '@/components/shared/page-loader';
import { Button } from '@/components/ui/button';
import { HostPageShell, HostStatCard } from '@/components/host/host-page-shell';
import { formatInr, cn } from '@/lib/utils';
import {
  toWithdrawalDisplayStatus,
  WITHDRAWAL_STATUS_STYLES,
} from '@/lib/withdrawal-status';

function EarningsStatusBadge({ status }: { status: string }) {
  const styles =
    status === 'available'
      ? 'bg-emerald-500/15 text-emerald-400'
      : status === 'held'
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-white/10 text-[#A7A7B3]';

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', styles)}>
      {status === 'held' ? 'Pending' : status === 'available' ? 'Completed' : status}
    </span>
  );
}

export default function HostEarningsPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [history, setHistory] = useState<EarningHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([hostsApi.getEarnings(), hostsApi.getEarningsHistory()])
      .then(([s, h]) => {
        setSummary(s);
        setHistory(h.items);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader variant="dashboard" />;
  if (!summary) {
    return (
      <HostPageShell>
        <p className="rounded-2xl border border-white/10 bg-[#17171C] p-8 text-center text-[#A7A7B3]">
          Unable to load earnings
        </p>
      </HostPageShell>
    );
  }

  return (
    <HostPageShell className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Earnings</h1>
        <p className="mt-1 text-sm text-[#A7A7B3] sm:text-base">
          Track your earnings, calls and performance
          <span className="hidden sm:inline">
            {' '}
            · Fee {summary.platformFeePercent}% · ₹{summary.inrPerCoin}/coin
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HostStatCard
          label="Total Earnings"
          value={formatInr(summary.totalEarnedInr)}
          sub={`${summary.totalEarnedCoins.toFixed(0)} coins`}
          icon={TrendingUp}
          accent="text-emerald-400"
        />
        <HostStatCard
          label="Available Balance"
          value={formatInr(summary.availableBalanceInr)}
          sub="Released earnings"
          icon={Wallet}
        />
        <HostStatCard
          label="Pending Balance"
          value={formatInr(summary.pendingBalanceInr)}
          sub={`${summary.pendingBalanceCoins.toFixed(0)} coins on hold`}
          icon={Clock}
          accent="text-amber-400"
        />
        <HostStatCard
          label="Total Calls"
          value={String(summary.totalCalls)}
          sub={`${summary.totalMinutes} min total`}
          icon={Phone}
        />
      </div>

      <Button
        asChild
        className="h-12 w-full max-w-md rounded-xl border-0 text-base font-semibold gradient-primary shadow-[0_6px_28px_rgba(255,46,116,0.35)] sm:h-14"
      >
        <Link href="/host/withdraw">
          <ArrowDownToLine className="mr-2 h-5 w-5" />
          Withdraw Funds
        </Link>
      </Button>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
          Earnings History
        </h2>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-10 text-center">
            <IndianRupee className="mx-auto h-10 w-10 text-[#A7A7B3]/40" />
            <p className="mt-3 font-medium text-white">No earnings yet</p>
            <p className="mt-1 text-sm text-[#A7A7B3]">Complete paid calls to start earning</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95 md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-[#A7A7B3]">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Call ID</th>
                      <th className="px-4 py-3 text-right font-semibold">Minutes</th>
                      <th className="px-4 py-3 text-right font-semibold">Coins</th>
                      <th className="px-4 py-3 text-right font-semibold">Gross</th>
                      <th className="px-4 py-3 text-right font-semibold">Fee</th>
                      <th className="px-4 py-3 text-right font-semibold">Host Earnings</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {history.map((row) => (
                      <tr
                        key={row.callId}
                        className="text-white/90 transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-[#A7A7B3]">
                          {new Date(row.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#A7A7B3]">
                          {row.callId.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.minutes}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.coins}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatInr(row.grossInr)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-400/80">
                          {formatInr(row.platformFeeInr)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-400">
                          {formatInr(row.hostInr)}
                        </td>
                        <td className="px-4 py-3">
                          <EarningsStatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {history.map((row) => (
                <div
                  key={row.callId}
                  className="rounded-xl border border-white/8 bg-[#17171C]/95 px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold tabular-nums text-emerald-400">
                        {formatInr(row.hostInr)}
                      </p>
                      <p className="mt-0.5 text-xs text-[#A7A7B3]">
                        {new Date(row.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        · {row.minutes} min · {row.coins} coins
                      </p>
                    </div>
                    <EarningsStatusBadge status={row.status} />
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-[#6B6B78]">
                    {row.callId.slice(0, 12)}…
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {summary.withdrawals.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
              Recent Withdrawals
            </h2>
            <Link
              href="/host/withdraw"
              className="text-sm font-medium text-[#FF6B9D] hover:underline"
            >
              Manage withdrawals →
            </Link>
          </div>
          <div className="divide-y divide-white/6 overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95">
            {summary.withdrawals.slice(0, 5).map((w) => (
              <div key={w.id as string} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="font-semibold text-white">
                    {formatInr(Number(w.amountInr ?? 0))}
                  </p>
                  <span
                    className={cn(
                      'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      WITHDRAWAL_STATUS_STYLES[
                        toWithdrawalDisplayStatus((w.displayStatus ?? w.status) as string)
                      ],
                    )}
                  >
                    {toWithdrawalDisplayStatus((w.displayStatus ?? w.status) as string)}
                  </span>
                </div>
                <p className="text-xs text-[#A7A7B3]">
                  {new Date(w.createdAt as string).toLocaleDateString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </HostPageShell>
  );
}
