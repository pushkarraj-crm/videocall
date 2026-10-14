'use client';

import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { giftsApi } from '@/lib/api/gifts';
import { PageLoader } from '@/components/shared/page-loader';
import { EmptyState } from '@/components/shared/empty-state';
import { SettingsPageShell } from '@/components/settings/settings-page-shell';
import { SettingsBackHeader } from '@/components/settings/settings-back-header';

export default function GiftHistoryPage() {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof giftsApi.history>>['items']
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    giftsApi
      .history(1, 50)
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader variant="generic" />;

  return (
    <SettingsPageShell narrow>
      <SettingsBackHeader
        title="Gift History"
        subtitle="Gifts you've sent"
        icon={<Gift className="h-5 w-5 text-[#FF2E74]" />}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No gifts yet"
          description="Send a gift during a call to see it here."
          className="mt-4"
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-[#17171C]/90 px-3.5 py-3 sm:gap-4 sm:px-4 sm:py-3.5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-2xl sm:h-14 sm:w-14 sm:rounded-2xl sm:text-3xl">
                {item.gift.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white sm:text-base">
                  {item.gift.name}
                  {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </p>
                <p className="text-xs text-[#A7A7B3] sm:text-sm">
                  to {item.recipient.displayName}
                </p>
                <p className="mt-0.5 text-[11px] text-[#6B6B78]">
                  {new Date(item.createdAt).toLocaleDateString()} · {item.status}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold tabular-nums text-[#FFB347]">{item.coinCoins}</p>
                <p className="text-[10px] text-[#A7A7B3]">coins</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsPageShell>
  );
}
