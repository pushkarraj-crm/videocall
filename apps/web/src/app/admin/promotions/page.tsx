'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, Search, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminPromoRecord, type PromoAnalytics } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { cn } from '@/lib/utils';

const CAMPAIGN_TYPES = [
  'welcome',
  'first_recharge',
  'weekend',
  'festival',
  'flash_sale',
  'cashback',
  'bonus_coins',
  'vip',
  'manual',
  'referral_bonus',
  'limited_time',
];

const DISCOUNT_TYPES = ['fixed_amount', 'percentage', 'bonus_coins', 'cashback', 'mixed'];

export default function AdminPromotionsPage() {
  const [records, setRecords] = useState<AdminPromoRecord[]>([]);
  const [analytics, setAnalytics] = useState<PromoAnalytics | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [form, setForm] = useState({
    code: '',
    title: '',
    campaignType: 'manual',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscount: 100,
    minimumRecharge: 99,
    bonusCoins: 0,
    cashbackCoins: 0,
    usageLimit: 1000,
    usagePerUser: 1,
    visibility: 'public',
    expiresAt: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.promotions({
        search: search.trim() || undefined,
        status: status || undefined,
        limit: 30,
      });
      setRecords(res.items);
      setTotal(res.total);
      setAnalytics(res.analytics);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    try {
      await adminApi.createPromotion({
        ...form,
        isActive: true,
        expiresAt: form.expiresAt || undefined,
      });
      toast.success('Coupon created');
      setShowBuilder(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    await adminApi.updatePromotion(id, { isActive: !isActive });
    await load();
  };

  const clone = async (id: string) => {
    await adminApi.clonePromotion(id);
    toast.success('Cloned');
    await load();
  };

  if (loading && records.length === 0) {
    return <PageLoader label="Loading promotions..." />;
  }

  return (
    <div className="premium-glow-bg mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
            <Tag className="h-5 w-5 text-[#FF6B9D]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Promotions</h1>
            <p className="text-sm text-muted-foreground">{total} coupons</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void adminApi.exportPromotionsCsv().then((csv) => {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `promotions-${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }).catch(() => toast.error('Export failed'))}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button className="gradient-primary border-0" onClick={() => setShowBuilder((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Coupon
          </Button>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.totalCoupons}</p>
            <p className="text-xs text-muted-foreground">Total coupons</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.totalRedemptions}</p>
            <p className="text-xs text-muted-foreground">Redemptions</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">{analytics.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Conversion</p>
          </div>
          <div className="premium-card border-white/8 bg-[#17171C]/90 p-4">
            <p className="text-2xl font-bold">₹{analytics.revenueGenerated}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
        </div>
      )}

      {showBuilder && (
        <div className="premium-card space-y-3 border-white/8 bg-[#17171C]/90 p-4">
          <h2 className="font-semibold">Coupon Builder</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={form.campaignType} onChange={(e) => setForm({ ...form, campaignType: e.target.value })}>
              {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              {DISCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input type="number" placeholder="Discount value" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
            <Input type="number" placeholder="Max discount ₹" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })} />
            <Input type="number" placeholder="Min recharge" value={form.minimumRecharge} onChange={(e) => setForm({ ...form, minimumRecharge: Number(e.target.value) })} />
            <Input type="number" placeholder="Bonus coins" value={form.bonusCoins} onChange={(e) => setForm({ ...form, bonusCoins: Number(e.target.value) })} />
            <Input type="number" placeholder="Cashback coins" value={form.cashbackCoins} onChange={(e) => setForm({ ...form, cashbackCoins: Number(e.target.value) })} />
            <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <Button className="gradient-primary border-0" onClick={() => void create()}>Save Coupon</Button>
        </div>
      )}

      <div className="premium-card space-y-3 border-white/8 bg-[#17171C]/90 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search code, title..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="space-y-3">
        {records.map((row) => (
          <div key={row.id} className="premium-card flex flex-wrap items-center justify-between gap-3 border-white/8 bg-[#17171C]/90 p-4">
            <div>
              <p className="font-mono text-sm text-[#FF6B9D]">{row.code}</p>
              <p className="text-sm text-white">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                {row.campaignType} · {row.discountType} · {row.currentUsage}/{row.usageLimit ?? '∞'} uses
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-xs', row.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground')}>
                {row.isActive ? 'Active' : 'Inactive'}
              </span>
              <Button size="sm" variant="outline" onClick={() => void toggle(row.id, row.isActive)}>
                {row.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void clone(row.id)}>Clone</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}