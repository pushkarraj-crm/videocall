'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/shared/page-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TxItem = {
  id: string;
  user: { displayName: string; email?: string | null };
  type: string;
  amountCoins: number;
  balanceAfterCoins: number;
  description?: string | null;
  createdAt: string;
};

export default function AdminWalletPage() {
  const [overview, setOverview] = useState<{
    walletCount: number;
    transactionCount: number;
    totalBalanceCoins: number;
  } | null>(null);
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tx] = await Promise.all([
        adminApi.walletOverview(),
        adminApi.walletTransactions(),
      ]);
      setOverview(ov);
      setTxs(tx.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !overview) return <PageLoader />;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">Wallet Management</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-[#17171C]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A7A7B3]">Wallets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-white">{overview.walletCount}</CardContent>
        </Card>
        <Card className="border-white/10 bg-[#17171C]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A7A7B3]">Total Balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-[#FFB347]">
            {overview.totalBalanceCoins.toLocaleString()} coins
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#17171C]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A7A7B3]">Transactions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-white">
            {overview.transactionCount.toLocaleString()}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#17171C]">
        <div className="border-b border-white/8 px-4 py-3 text-sm font-medium text-white">
          Recent transactions
        </div>
        <div className="divide-y divide-white/5">
          {txs.length === 0 ? (
            <p className="p-6 text-sm text-[#A7A7B3]">No transactions yet.</p>
          ) : (
            txs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">{tx.user.displayName}</p>
                  <p className="text-xs text-[#A7A7B3]">
                    {tx.type} · {tx.description ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={tx.amountCoins >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {tx.amountCoins >= 0 ? '+' : ''}
                    {tx.amountCoins} coins
                  </p>
                  <p className="text-xs text-[#A7A7B3]">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}