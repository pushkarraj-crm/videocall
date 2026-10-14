'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Coins, History, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageLoader } from '@/components/shared/page-loader';
import { PageHeader } from '@/components/shared/page-header';
import { CoinPackageCard, type CoinPackageCardData } from '@/components/wallet/coin-package-card';
import { useWallet } from '@/hooks/use-wallet';
import { FREE_CALL_LIMIT, COINS_PER_MINUTE } from '@/lib/constants';
import { coinsToMinutes, formatCoins, cn } from '@/lib/utils';
import { layout, typography } from '@/lib/design-tokens';
import { paymentsApi } from '@/lib/api/payments';
import { useRouter } from 'next/navigation';
import {
  walletApi,
  ledgerTypeLabel,
  type LedgerEntry,
} from '@/lib/api/wallet';

const HISTORY_PREVIEW = 8;

export default function WalletPage() {
  const router = useRouter();
  const { wallet, isLoading } = useWallet();
  const [packages, setPackages] = useState<CoinPackageCardData[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    paymentsApi
      .getPackages()
      .then((pkgs) => {
        if (!cancelled) setPackages(pkgs as CoinPackageCardData[]);
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      })
      .finally(() => {
        if (!cancelled) setPackagesLoading(false);
      });

    walletApi
      .getLedger(1, 50)
      .then((res) => {
        if (!cancelled) setHistory(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Hooks must run every render — never after an early return.
  const rechargeItems = useMemo(
    () =>
      history.filter(
        (tx) =>
          tx.type === 'payment_credit' ||
          tx.description?.toLowerCase().includes('recharge') ||
          Number(tx.amountUnits) > 0,
      ),
    [history],
  );

  if (isLoading) return <PageLoader variant="wallet" />;

  const coins = wallet?.balanceCoins ?? 0;
  const freeUsed = wallet?.freeCallsUsed ?? 0;
  const freeRemaining = wallet?.freeCallsRemaining ?? FREE_CALL_LIMIT;

  /** Show a curated grid of offers (all packages; purchase has full flow). */
  const offerPackages = packages.slice(0, 6);

  const visibleHistory = historyExpanded
    ? rechargeItems
    : rechargeItems.slice(0, HISTORY_PREVIEW);
  const hasMoreHistory = rechargeItems.length > HISTORY_PREVIEW;

  return (
    <div className={`${layout.page} px-4 pb-12 pt-6 sm:px-6 sm:pb-14 sm:pt-8 lg:px-10 xl:px-12`}>
      <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
        <PageHeader
          title="Wallet"
          subtitle="Manage your coins and recharge"
          icon={<Coins className="h-5 w-5 text-[#FF2E74]" />}
        />

        <Card className="premium-card overflow-hidden border-0">
          <div className="gradient-primary p-6 text-primary-foreground sm:p-8">
            <p className="text-sm font-medium opacity-90">Your Balance</p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
              {coins.toFixed(0)}
            </p>
            <p className="mt-1 text-sm opacity-80 sm:text-base">
              coins · ≈ {coinsToMinutes(coins, COINS_PER_MINUTE)} min of calls
            </p>
          </div>
        </Card>

        <Card className="premium-card border-white/8">
          <CardContent className="space-y-3 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className={typography.label}>Free calls</span>
              <span className="text-sm font-semibold text-white sm:text-base">
                {freeRemaining} left
              </span>
            </div>
            <Progress
              value={((FREE_CALL_LIMIT - freeRemaining) / FREE_CALL_LIMIT) * 100}
              className="h-2 bg-white/5"
            />
            <p className={typography.caption}>
              {freeUsed}/{FREE_CALL_LIMIT} used · {COINS_PER_MINUTE} coins/min after quota
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Button
            variant="gradient"
            className="h-12 cursor-pointer text-base"
            asChild
          >
            <Link href="/wallet/purchase">
              <Sparkles className="h-4 w-4" />
              Recharge
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-12 cursor-pointer text-base"
            type="button"
            onClick={() => {
              setHistoryOpen((o) => !o);
              if (!historyOpen) {
                document.getElementById('recharge-history')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }
            }}
          >
            <History className="h-4 w-4" />
            History
          </Button>
        </div>

        {/* Inline recharge history */}
        <section id="recharge-history" className="scroll-mt-24 pt-1">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Recharge History
              </h2>
              <p className="mt-1 text-sm text-[#A7A7B3]">Your recent wallet activity</p>
            </div>
          </div>

          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl border border-white/8 bg-[#17171C]"
                />
              ))}
            </div>
          ) : visibleHistory.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-8 text-center">
              <p className="text-sm text-[#A7A7B3]">No recharges yet</p>
              <Button className="mt-4 cursor-pointer gradient-primary border-0" asChild>
                <Link href="/wallet/purchase">Recharge now</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleHistory.map((tx) => {
                const positive = Number(tx.amountUnits) > 0;
                const title = ledgerTypeLabel(tx.type, tx.description);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#17171C]/95 px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-xs text-[#A7A7B3]">
                        {new Date(tx.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {tx.status ? ` · ${tx.status}` : ''}
                      </p>
                      {tx.referenceId && (
                        <p className="mt-0.5 font-mono text-[10px] text-[#6B6B78]">
                          {tx.referenceId.slice(0, 14)}…
                        </p>
                      )}
                    </div>
                    <p
                      className={cn(
                        'shrink-0 text-sm font-bold tabular-nums',
                        positive ? 'text-emerald-400' : 'text-white',
                      )}
                    >
                      {positive ? '+' : ''}
                      {formatCoins(tx.amountUnits)} coins
                    </p>
                  </div>
                );
              })}
              {hasMoreHistory && !historyExpanded && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    className="cursor-pointer text-sm font-medium text-[#FF6B9D] hover:underline"
                    onClick={() => setHistoryExpanded(true)}
                  >
                    View all
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Special offers */}
        <section className="pt-2">
          <div className="mb-5 flex flex-col gap-1 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Special Offers
              </h2>
              <p className="mt-1 text-sm text-[#A7A7B3]">Recharge more. Save more.</p>
            </div>
          </div>

          {packagesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-2xl border border-white/8 bg-[#17171C]"
                />
              ))}
            </div>
          ) : offerPackages.length === 0 ? (
            <div className="premium-card p-6 text-center text-sm text-[#A7A7B3]">
              Packages will appear here when available.{' '}
              <Link href="/wallet/purchase" className="text-[#FF6B9D] hover:underline">
                Open recharge
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offerPackages.map((pkg) => (
                <CoinPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onPurchase={() => router.push(`/wallet/purchase?package=${pkg.id}`)}
                />
              ))}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              size="lg"
              className="h-12 min-w-[180px] rounded-full border-white/15 bg-white/5 px-8 text-base font-semibold text-white hover:bg-white/10"
              asChild
            >
              <Link href="/wallet/purchase">
                More Plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
