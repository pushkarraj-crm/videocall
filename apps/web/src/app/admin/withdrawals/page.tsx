'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminApi, type AdminWithdrawal } from '@/lib/api/admin';
import { PageLoader } from '@/components/shared/page-loader';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { FilterPills } from '@/components/shared/filter-pills';
import { cn } from '@/lib/utils';
import { toWithdrawalDisplayStatus, WITHDRAWAL_STATUS_STYLES } from '@/lib/withdrawal-status';

type FilterStatus = 'all' | 'requested' | 'approved' | 'rejected' | 'completed';

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'requested', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'completed', label: 'Paid' },
];

function StatusBadge({ status }: { status: string }) {
  const display = toWithdrawalDisplayStatus(status);
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
        WITHDRAWAL_STATUS_STYLES[display],
      )}
    >
      {display}
    </span>
  );
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [actionId, setActionId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const status = filter === 'all' ? undefined : filter;
    const res = await adminApi.getWithdrawals(status);
    setWithdrawals(res.items);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const runAction = async (
    id: string,
    action: 'approve' | 'reject' | 'paid',
  ) => {
    const note = noteById[id]?.trim();
    setActionId(id);
    try {
      if (action === 'approve') await adminApi.approveWithdrawal(id, note);
      if (action === 'reject') {
        await adminApi.rejectWithdrawal(id, note || 'Rejected by admin');
      }
      if (action === 'paid') {
        await adminApi.markWithdrawalPaid(id, undefined, note || 'Payment sent');
      }
      toast.success(
        action === 'paid' ? 'Marked as paid' : `Withdrawal ${action}d`,
      );
      setNoteById((prev) => ({ ...prev, [id]: '' }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <PageLoader variant="admin" />;

  return (
    <div>
      <AdminPageHeader title="Withdrawal Requests" subtitle="Review and process host payouts" />

      <FilterPills options={FILTERS} value={filter} onChange={setFilter} className="mb-6" />

      {withdrawals.length === 0 ? (
        <Card className="premium-card border-white/8">
          <CardContent className="py-12 text-center text-[#A7A7B3]">
            No withdrawal requests
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => (
            <Card key={w.id} className="premium-card border-white/8 transition-transform hover:scale-[1.005]">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>{w.host.displayName}</span>
                  <StatusBadge status={w.displayStatus ?? w.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-lg font-semibold">₹{w.netInr}</p>
                <p className="text-muted-foreground">
                  {w.upiId
                    ? `${w.accountHolderName ?? '—'} · ${w.upiId}`
                    : w.bankAccount
                      ? `${w.bankAccount.accountHolderName} · ${w.bankAccount.accountNumberMasked} · ${w.bankAccount.ifscCode}`
                      : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(w.createdAt).toLocaleString('en-IN')}
                </p>
                {w.adminNote && (
                  <p className="rounded-md bg-muted px-2 py-1 text-xs">Note: {w.adminNote}</p>
                )}
                {w.rejectionReason && w.status === 'rejected' && (
                  <p className="text-xs text-red-600">Rejected: {w.rejectionReason}</p>
                )}

                {(w.status === 'requested' || w.status === 'approved') && (
                  <div className="space-y-2 pt-2">
                    <div>
                      <Label className="text-xs">Admin note</Label>
                      <Input
                        placeholder={
                          w.status === 'approved' ? 'Payment sent' : 'Optional note'
                        }
                        value={noteById[w.id] ?? ''}
                        onChange={(e) =>
                          setNoteById((prev) => ({ ...prev, [w.id]: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                            Mark Paid
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
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}