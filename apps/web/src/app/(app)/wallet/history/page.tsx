'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { walletApi, ledgerTypeLabel, type LedgerEntry } from '@/lib/api/wallet';
import { PageLoader } from '@/components/shared/page-loader';
import { EmptyState } from '@/components/shared/empty-state';
import { TimelineList, TimelineRow } from '@/components/shared/timeline-row';
import { Button } from '@/components/ui/button';
import { formatCoins } from '@/lib/utils';
import Link from 'next/link';
import { SettingsPageShell } from '@/components/settings/settings-page-shell';
import { SettingsBackHeader } from '@/components/settings/settings-back-header';

function displayLabel(tx: LedgerEntry): string {
  if (tx.description?.startsWith('Recharge ₹')) return tx.description;
  return ledgerTypeLabel(tx.type, tx.description);
}

export default function WalletHistoryPage() {
  const [items, setItems] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    walletApi.getLedger().then((res) => {
      setItems(res.items);
      setLoading(false);
    });
  }, []);

  if (loading) return <PageLoader variant="list" />;

  return (
    <SettingsPageShell narrow>
      <SettingsBackHeader
        title="Transaction History"
        subtitle={`${items.length} transactions`}
        backHref="/wallet"
        backLabel="Back to Wallet"
        icon={<History className="h-5 w-5 text-[#FF2E74]" />}
      />

      {items.length === 0 ? (
        <div className="premium-card">
          <EmptyState
            icon={History}
            title="No transactions yet"
            description="Recharges, call charges, and gifts will show up here."
            action={
              <Button variant="gradient" className="cursor-pointer" asChild>
                <Link href="/wallet/purchase">Recharge now</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <TimelineList>
          {items.map((tx) => {
            const positive = Number(tx.amountUnits) > 0;
            const amountLabel =
              tx.type === 'withdrawal' || tx.type === 'call_earning'
                ? formatCoins(Math.abs(Number(tx.amountUnits)))
                : `${positive ? '+' : ''}${formatCoins(tx.amountUnits)} coins`;

            return (
              <TimelineRow
                key={tx.id}
                title={displayLabel(tx)}
                subtitle={
                  tx.description && !tx.description.startsWith('Recharge ₹')
                    ? tx.description
                    : tx.status
                      ? tx.status
                      : undefined
                }
                meta={new Date(tx.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                amount={amountLabel}
                amountPositive={positive}
              />
            );
          })}
        </TimelineList>
      )}
    </SettingsPageShell>
  );
}
