'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Search, Sparkles, X } from 'lucide-react';
import { giftsApi } from '@/lib/api/gifts';
import type { GiftCatalogItem, GiftCategory } from '@/lib/gifts/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<GiftCategory, string> = {
  basic: 'Basic',
  premium: 'Premium',
  luxury: 'Luxury',
  vip: 'VIP',
};

interface GiftStoreSheetProps {
  open: boolean;
  onClose: () => void;
  balance: number;
  disabled?: boolean;
  sending?: boolean;
  onSend: (gift: GiftCatalogItem, quantity: number) => Promise<void>;
  onInsufficientBalance: () => void;
}

export function GiftStoreSheet({
  open,
  onClose,
  balance,
  disabled,
  sending,
  onSend,
  onInsufficientBalance,
}: GiftStoreSheetProps) {
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<GiftCategory | 'all' | 'featured' | 'trending'>('all');
  const [selected, setSelected] = useState<GiftCatalogItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await giftsApi.catalog({
        category: category !== 'all' && category !== 'featured' && category !== 'trending' ? category : undefined,
        featured: category === 'featured',
        trending: category === 'trending',
      });
      setCatalog(res.items);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (g) => g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q),
    );
  }, [catalog, search]);

  const totalCost = selected ? selected.coinPrice * quantity : 0;

  const handleConfirm = async () => {
    if (!selected || disabled || sending) return;
    if (balance < totalCost) {
      onInsufficientBalance();
      return;
    }
    setConfirming(true);
    try {
      await onSend(selected, quantity);
      setSelected(null);
      setQuantity(1);
      setConfirming(false);
      onClose();
    } catch {
      setConfirming(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close gift store"
        onClick={onClose}
      />
      <div className="relative max-h-[85dvh] animate-slide-up rounded-t-[28px] border-t border-white/10 bg-[#17171C] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-[#FF2E74]" />
            <h2 className="text-lg font-bold text-white">Gift Store</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#A7A7B3] hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A7A7B3]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search gifts…"
              className="border-white/10 bg-white/5 pl-9 text-white"
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['all', 'featured', 'trending', 'basic', 'premium', 'luxury', 'vip'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  category === c
                    ? 'gradient-primary text-white'
                    : 'bg-white/5 text-[#A7A7B3] hover:bg-white/10',
                )}
              >
                {c === 'all' ? 'All' : c === 'featured' ? 'Featured' : c === 'trending' ? 'Trending' : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#A7A7B3]">
            Balance: <span className="font-semibold text-[#FFB347]">{balance}</span> coins
          </p>
        </div>

        <div className="grid max-h-[40dvh] grid-cols-3 gap-2 overflow-y-auto px-5 py-4 sm:grid-cols-4">
          {loading ? (
            <p className="col-span-full py-8 text-center text-sm text-[#A7A7B3]">Loading gifts…</p>
          ) : (
            filtered.map((gift) => {
              const afford = balance >= gift.coinPrice;
              return (
                <button
                  key={gift.id}
                  type="button"
                  disabled={disabled || !afford}
                  onClick={() => {
                    setSelected(gift);
                    setQuantity(1);
                  }}
                  className={cn(
                    'premium-glass flex flex-col items-center gap-1 rounded-2xl p-3 transition-transform press-scale',
                    selected?.id === gift.id && 'ring-2 ring-[#FF2E74]',
                    !afford && 'opacity-40',
                  )}
                >
                  {gift.isTrending && (
                    <Sparkles className="absolute h-3 w-3 text-[#FFB347]" aria-hidden />
                  )}
                  <span className="text-3xl">{gift.icon}</span>
                  <span className="truncate text-[11px] font-medium text-white">{gift.name}</span>
                  <span className="text-[10px] text-[#FFB347]">{gift.coinPrice}</span>
                </button>
              );
            })
          )}
        </div>

        {selected && (
          <div className="border-t border-white/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{selected.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-white">{selected.name}</p>
                <p className="text-xs text-[#A7A7B3]">{selected.coinPrice} coins each</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-2 py-1">
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-white/10 text-white"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-bold text-white">{quantity}</span>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-white/10 text-white"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                >
                  +
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-[#A7A7B3]">
              Total: <span className="font-bold text-[#FFB347]">{totalCost}</span> coins
            </p>
            <Button
              className="mt-3 w-full"
              variant="gradient"
              disabled={disabled || sending || confirming}
              loading={confirming || sending}
              onClick={() => void handleConfirm()}
            >
              Send {quantity > 1 ? `${quantity} ` : ''}
              {selected.name}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}