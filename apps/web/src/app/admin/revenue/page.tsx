'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi, type PlatformRevenueDetail } from '@/lib/api/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { formatInr } from '@/lib/utils';

export default function AdminRevenuePage() {
  const [revenue, setRevenue] = useState<PlatformRevenueDetail | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () =>
    adminApi.getRevenue().then((d) => setRevenue(d as PlatformRevenueDetail));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const transfer = async () => {
    const amount = Number(transferAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setBusy(true);
    try {
      await adminApi.withdrawPlatformRevenue(amount);
      toast.success('Revenue transferred');
      setTransferAmount('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusy(false);
    }
  };

  const settle = async () => {
    const amount = Number(settleAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setBusy(true);
    try {
      await adminApi.markRevenueSettled(amount);
      toast.success('Revenue marked settled');
      setSettleAmount('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Settlement failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !revenue) return <PageLoader label="Loading revenue..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Revenue</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Total Revenue', value: formatInr(revenue.totalRevenueInr) },
          { label: "Today's Revenue", value: formatInr(revenue.todayRevenueInr) },
          { label: 'Monthly Revenue', value: formatInr(revenue.monthlyRevenueInr) },
          { label: 'Pending Revenue', value: formatInr(revenue.pendingRevenueInr) },
          { label: 'Available Revenue', value: formatInr(revenue.availableRevenueInr), highlight: true },
          { label: 'Service Fees Collected', value: formatInr(revenue.platformFeesInr) },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${s.highlight ? 'text-emerald-600' : ''}`}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transfer Revenue</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              type="number"
              placeholder="Amount in INR"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
            />
            <Button disabled={busy} onClick={transfer}>
              Transfer
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mark Settled</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              type="number"
              placeholder="Amount in INR"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
            />
            <Button variant="outline" disabled={busy} onClick={settle}>
              Settle
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settlement History</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settlements yet</p>
          ) : (
            <div className="divide-y">
              {revenue.settlements.map((s) => (
                <div key={s.id} className="flex justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">Transfer {formatInr(s.amountInr)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-muted-foreground">
                    Total withdrawn {formatInr(s.totalWithdrawn)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin Earnings Ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Recharge revenue</span>
            <span className="font-medium">{formatInr(revenue.rechargeRevenueInr)}</span>
          </div>
          <div className="flex justify-between">
            <span>Service fees</span>
            <span className="font-medium">{formatInr(revenue.platformFeesInr)}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span>Withdrawn to bank</span>
            <span className="font-medium">{formatInr(revenue.withdrawnInr)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Available balance</span>
            <span className="text-emerald-600">{formatInr(revenue.availableRevenueInr)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}