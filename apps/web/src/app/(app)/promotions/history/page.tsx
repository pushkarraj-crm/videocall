'use client';

import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { toast } from 'sonner';
import { promotionsApi, type PromoHistoryItem } from '@/lib/api/promotions';
import { PageLoader } from '@/components/shared/page-loader';
import { PageHeader } from '@/components/shared/page-header';
import { Screen } from '@/components/shared/screen';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatInr } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function PromoHistoryPage() {
  const [items, setItems] = useState<PromoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    promotionsApi
      .history()
      .then((res) => setItems(res.items))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader variant="list" />;

  return (
    <Screen>
      <PageHeader
        title="Promo History"
        subtitle={`${items.length} redemptions`}
        icon={<Tag className="h-5 w-5 text-[#FF2E74]" />}
      />

      {items.length === 0 ? (
        <div className="premium-card">
          <EmptyState
            icon={Tag}
            title="No coupons used yet"
            description="Apply a promo code during recharge to save on coins."
            action={
              <Button variant="gradient" asChild>
                <Link href="/wallet/purchase">Browse packages</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <div
              key={row.id}
              className="premium-card border-white/8 bg-[#17171C]/90 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-[#FF6B9D]">{row.couponCode}</p>
                  <p className="text-sm text-white">{row.couponTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    row.status === 'COMPLETED' && 'bg-emerald-500/15 text-emerald-400',
                    row.status === 'PENDING' && 'bg-amber-500/15 text-amber-400',
                    row.status === 'CASHBACK_PENDING' && 'bg-sky-500/15 text-sky-400',
                  )}
                >
                  {row.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div>
                  <p className="text-white">{formatInr(row.rechargeAmount)}</p>
                  <p>Recharge</p>
                </div>
                <div>
                  <p className="text-emerald-400">{formatInr(row.discountApplied)}</p>
                  <p>Discount</p>
                </div>
                <div>
                  <p className="text-white">+{row.bonusCoinsGiven}</p>
                  <p>Bonus coins</p>
                </div>
                <div>
                  <p className="text-white">+{row.cashbackCoinsGiven}</p>
                  <p>Cashback</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}