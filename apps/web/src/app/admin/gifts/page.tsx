'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminGiftItem, type GiftAnalytics } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { cn } from '@/lib/utils';

export default function AdminGiftsPage() {
  const [items, setItems] = useState<AdminGiftItem[]>([]);
  const [analytics, setAnalytics] = useState<GiftAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    slug: '',
    name: '',
    icon: '🎁',
    category: 'basic',
    coinPrice: 10,
    animationTier: 'floating',
    animationKey: 'floating_float',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([adminApi.gifts(), adminApi.giftAnalytics()]);
      setItems(list);
      setAnalytics(stats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    try {
      await adminApi.createGift(form);
      toast.success('Gift created');
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const toggle = async (id: string, isEnabled: boolean) => {
    try {
      await adminApi.updateGift(id, { isEnabled: !isEnabled });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  if (loading) return <PageLoader variant="generic" />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gift Catalog</h1>
          <p className="text-sm text-[#A7A7B3]">Manage premium gifts, pricing & animations</p>
        </div>
        <Button variant="gradient" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> Create Gift
        </Button>
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-[#A7A7B3]">Total sent</p>
            <p className="text-2xl font-bold text-white">{analytics.totalGiftsSent}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-[#A7A7B3]">Revenue</p>
            <p className="text-2xl font-bold text-[#FFB347]">{analytics.giftRevenueCoins}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-[#A7A7B3]">Avg value</p>
            <p className="text-2xl font-bold text-white">{analytics.averageGiftValueCoins}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-xs text-[#A7A7B3]">This month</p>
            <p className="text-2xl font-bold text-white">{analytics.monthlyGiftCount}</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <Input placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            <Input type="number" placeholder="coins" value={form.coinPrice} onChange={(e) => setForm({ ...form, coinPrice: Number(e.target.value) })} />
          </div>
          <Button className="mt-3" onClick={() => void create()}>Save</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[#A7A7B3]">
            <tr>
              <th className="p-3">Gift</th>
              <th className="p-3">Category</th>
              <th className="p-3">Coins</th>
              <th className="p-3">Animation</th>
              <th className="p-3">Flags</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.catalogId} className="border-t border-white/5">
                <td className="p-3">
                  <span className="mr-2 text-xl">{g.icon}</span>
                  {g.name}
                </td>
                <td className="p-3 capitalize text-[#A7A7B3]">{g.category}</td>
                <td className="p-3 font-semibold text-[#FFB347]">{g.coinPrice}</td>
                <td className="p-3 text-[#A7A7B3]">{g.animationKey}</td>
                <td className="p-3">
                  {g.isFeatured && <Sparkles className="inline h-4 w-4 text-[#FFB347]" />}
                  {g.isTrending && <Gift className="inline h-4 w-4 text-[#FF2E74]" />}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => void toggle(g.catalogId, g.isEnabled)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      g.isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400',
                    )}
                  >
                    {g.isEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}