'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi, type AdminWithdrawal } from '@/lib/api/admin';
import { PageLoader } from '@/components/shared/page-loader';

const STATUS_COLORS: Record<string, string> = {
  requested: 'text-amber-600',
  approved: 'text-blue-600',
  completed: 'text-emerald-600',
  rejected: 'text-red-600',
};

export default function AdminPaymentsPage() {
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminApi.getWithdrawals();
    setWithdrawals(res.items);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const runAction = async (id: string, action: 'approve' | 'reject' | 'paid') => {
    setActionId(id);
    try {
      if (action === 'approve') await adminApi.approveWithdrawal(id);
      if (action === 'reject') await adminApi.rejectWithdrawal(id, 'Rejected by admin');
      if (action === 'paid') await adminApi.markWithdrawalPaid(id);
      toast.success(`Withdrawal ${action === 'paid' ? 'marked paid' : action + 'd'}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <PageLoader label="Loading withdrawals..." />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Withdrawals</h1>
      {withdrawals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No withdrawal requests
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <Card key={w.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{w.host.displayName}</span>
                  <span className={`capitalize ${STATUS_COLORS[w.status] ?? ''}`}>
                    {w.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  {w.amountCoins} coins · ₹{w.netInr}
                </p>
                <p className="text-muted-foreground">
                  {w.upiId
                    ? `${w.accountHolderName ?? '—'} · ${w.upiId}`
                    : w.bankAccount
                      ? `${w.bankAccount.accountHolderName} · ${w.bankAccount.accountNumberMasked} · ${w.bankAccount.ifscCode}`
                      : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(w.createdAt).toLocaleString()}
                </p>
                <div className="flex gap-2 pt-2">
                  {w.status === 'requested' && (
                    <>
                      <Button
                        size="sm"
                        disabled={actionId === w.id}
                        onClick={() => runAction(w.id, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === w.id}
                        onClick={() => runAction(w.id, 'reject')}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {w.status === 'approved' && (
                    <>
                      <Button
                        size="sm"
                        disabled={actionId === w.id}
                        onClick={() => runAction(w.id, 'paid')}
                      >
                        Mark paid
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === w.id}
                        onClick={() => runAction(w.id, 'reject')}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}