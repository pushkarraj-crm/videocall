'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDownToLine, ChevronRight, Clock, IndianRupee, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { hostsApi, type EarningsSummary } from '@/lib/api/hosts';
import { PageLoader } from '@/components/shared/page-loader';
import { HostPageShell } from '@/components/host/host-page-shell';
import { formatInr, cn } from '@/lib/utils';
import {
  toWithdrawalDisplayStatus,
  WITHDRAWAL_STATUS_STYLES,
  type WithdrawalDisplayStatus,
} from '@/lib/withdrawal-status';

const MIN_WITHDRAWAL_INR = 500;
const RECENT_HISTORY_LIMIT = 8;

interface WithdrawalItem {
  id: string;
  amountInr: string;
  status: string;
  displayStatus?: string;
  upiId?: string | null;
  accountHolderName?: string | null;
  rejectionReason?: string | null;
  adminNote?: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const display =
    (status as WithdrawalDisplayStatus) in WITHDRAWAL_STATUS_STYLES
      ? (status as WithdrawalDisplayStatus)
      : toWithdrawalDisplayStatus(status);

  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
        WITHDRAWAL_STATUS_STYLES[display],
      )}
    >
      {display}
    </span>
  );
}

function maskUpi(upi?: string | null) {
  if (!upi) return null;
  const at = upi.indexOf('@');
  if (at <= 0) return upi;
  const name = upi.slice(0, at);
  const domain = upi.slice(at);
  if (name.length <= 2) return `••${domain}`;
  return `${name.slice(0, 2)}••${name.slice(-1)}${domain}`;
}

export default function HostWithdrawPage() {
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [history, setHistory] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [form, setForm] = useState({
    upiId: '',
    accountHolderName: '',
    amountInr: MIN_WITHDRAWAL_INR,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [summary, withdrawals] = await Promise.all([
      hostsApi.getEarnings(),
      hostsApi.getWithdrawals(1, 50),
    ]);
    setEarnings(summary);
    setHistory(withdrawals.items as unknown as WithdrawalItem[]);
    setForm((prev) => ({
      ...prev,
      amountInr: Math.min(
        Math.max(MIN_WITHDRAWAL_INR, prev.amountInr || MIN_WITHDRAWAL_INR),
        summary.withdrawableInr,
      ),
    }));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const validate = (): boolean => {
    if (!earnings) return false;
    const next: Record<string, string> = {};

    if (!form.upiId.trim() || !form.upiId.includes('@')) {
      next.upiId = 'Enter a valid UPI ID (e.g. name@upi)';
    }
    if (!form.accountHolderName.trim()) {
      next.accountHolderName = 'Account holder name is required';
    }
    if (form.amountInr <= 0) {
      next.amountInr = 'Amount must be greater than zero';
    } else if (form.amountInr < MIN_WITHDRAWAL_INR) {
      next.amountInr = `Minimum withdrawal is ${formatInr(MIN_WITHDRAWAL_INR)}`;
    } else if (form.amountInr > earnings.withdrawableInr) {
      next.amountInr = 'Amount exceeds available balance';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitWithdrawal = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await hostsApi.requestWithdrawalUpi({
        upiId: form.upiId.trim().toLowerCase(),
        accountHolderName: form.accountHolderName.trim(),
        amountUnits: Math.round(form.amountInr * 100),
        idempotencyKey: `withdraw:${Date.now()}`,
      });
      toast.success('Withdrawal request submitted');
      setModalOpen(false);
      setForm({ upiId: '', accountHolderName: '', amountInr: MIN_WITHDRAWAL_INR });
      setErrors({});
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !earnings) return <PageLoader label="Loading earnings..." />;

  const hasPending = history.some((w) =>
    ['requested', 'approved', 'processing', 'PENDING', 'APPROVED'].includes(
      w.displayStatus ?? w.status,
    ),
  );

  const visibleHistory = showAllHistory
    ? history
    : history.slice(0, RECENT_HISTORY_LIMIT);
  const hasMoreHistory = history.length > RECENT_HISTORY_LIMIT;

  return (
    <HostPageShell className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Withdraw Funds
        </h1>
        <p className="mt-1 text-sm text-[#A7A7B3] sm:text-base">
          Manage your available balance and withdrawals
        </p>
      </div>

      {/* Available balance hero */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="relative p-6 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF2E74]/12 via-transparent to-[#FFB347]/8"
            aria-hidden
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A7A7B3]">
              Available to withdraw
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {formatInr(earnings.withdrawableInr)}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#A7A7B3]">
              <span>
                Released earnings:{' '}
                <span className="font-medium text-white">
                  {formatInr(earnings.availableBalanceInr)}
                </span>
              </span>
              <span>
                Minimum:{' '}
                <span className="font-medium text-white">{formatInr(MIN_WITHDRAWAL_INR)}</span>
              </span>
              <span>
                Pending:{' '}
                <span className="font-medium text-amber-400">
                  {formatInr(earnings.pendingWithdrawalInr)}
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Supporting stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A7A7B3]">
            <Wallet className="h-4 w-4 text-[#FF2E74]" />
            Available
          </div>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatInr(earnings.withdrawableInr)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A7A7B3]">
            <Clock className="h-4 w-4 text-amber-400" />
            Pending
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-400">
            {formatInr(earnings.pendingWithdrawalInr)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A7A7B3]">
            <IndianRupee className="h-4 w-4 text-emerald-400" />
            Withdrawn
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {formatInr(earnings.completedWithdrawalInr)}
          </p>
        </div>
      </div>

      {/* Withdraw action */}
      <section className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Request withdrawal</h2>
        <p className="mt-1 text-sm text-[#A7A7B3]">
          Transfer released earnings to your UPI account. Minimum {formatInr(MIN_WITHDRAWAL_INR)}.
        </p>
        <Button
          className="mt-5 h-12 w-full max-w-md rounded-xl border-0 text-base font-semibold gradient-primary shadow-[0_6px_28px_rgba(255,46,116,0.35)]"
          disabled={earnings.withdrawableInr < MIN_WITHDRAWAL_INR || hasPending}
          onClick={() => setModalOpen(true)}
        >
          <ArrowDownToLine className="mr-2 h-5 w-5" />
          Withdraw
        </Button>
        {hasPending && (
          <p className="mt-3 text-sm text-amber-400">
            You have a pending withdrawal. Wait for it to be processed before requesting again.
          </p>
        )}
        {earnings.withdrawableInr < MIN_WITHDRAWAL_INR && !hasPending && (
          <p className="mt-3 text-sm text-[#A7A7B3]">
            Balance below minimum withdrawal of {formatInr(MIN_WITHDRAWAL_INR)}.
          </p>
        )}
      </section>

      {/* Withdrawal history — primary place for history (no nav item) */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
          Withdrawal History
        </h2>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-10 text-center">
            <p className="text-[#A7A7B3]">No withdrawals yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleHistory.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#17171C]/95 px-4 py-3.5 transition-colors hover:border-white/12 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-white sm:text-lg">
                      {formatInr(Number(w.amountInr))}
                    </p>
                    <StatusBadge status={w.displayStatus ?? w.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-[#A7A7B3]">
                    {w.upiId
                      ? `UPI ${maskUpi(w.upiId)}`
                      : w.accountHolderName
                        ? w.accountHolderName
                        : '—'}
                  </p>
                  {(w.rejectionReason || w.adminNote) && (
                    <p className="mt-0.5 text-xs text-[#A7A7B3]/80">
                      {w.rejectionReason ?? w.adminNote}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-[#6B6B78]">
                    {w.id.slice(0, 12)}…
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <p className="text-xs text-[#A7A7B3] sm:text-sm">
                    {new Date(w.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <ChevronRight className="hidden h-4 w-4 text-[#6B6B78] sm:block" />
                </div>
              </div>
            ))}

            {hasMoreHistory && !showAllHistory && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllHistory(true)}
                  className="text-sm font-medium text-[#FF6B9D] transition-colors hover:text-[#FF8AB0]"
                >
                  View all withdrawal history →
                </button>
              </div>
            )}
            {showAllHistory && hasMoreHistory && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllHistory(false)}
                  className="text-sm font-medium text-[#A7A7B3] hover:text-white"
                >
                  Show less
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-[#6B6B78]">
          <Link href="/host/earnings" className="text-[#FF6B9D] hover:underline">
            View earnings history
          </Link>
        </p>
      </section>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="border-white/10 bg-[#17171C] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-[#A7A7B3]">
              Available:{' '}
              <span className="font-medium text-white">
                {formatInr(earnings.withdrawableInr)}
              </span>
              {' · '}Min: {formatInr(MIN_WITHDRAWAL_INR)}
            </p>

            <div>
              <Label htmlFor="upiId">UPI ID</Label>
              <Input
                id="upiId"
                placeholder="name@upi"
                value={form.upiId}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                className="mt-1 border-white/10 bg-white/5"
              />
              {errors.upiId && <p className="mt-1 text-xs text-red-400">{errors.upiId}</p>}
            </div>

            <div>
              <Label htmlFor="holder">Account Holder Name</Label>
              <Input
                id="holder"
                placeholder="As per bank records"
                value={form.accountHolderName}
                onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
                className="mt-1 border-white/10 bg-white/5"
              />
              {errors.accountHolderName && (
                <p className="mt-1 text-xs text-red-400">{errors.accountHolderName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                min={MIN_WITHDRAWAL_INR}
                max={earnings.withdrawableInr}
                value={form.amountInr}
                onChange={(e) => setForm({ ...form, amountInr: Number(e.target.value) })}
                className="mt-1 border-white/10 bg-white/5"
              />
              {errors.amountInr && (
                <p className="mt-1 text-xs text-red-400">{errors.amountInr}</p>
              )}
            </div>

            <Button
              className="h-11 w-full border-0 gradient-primary"
              disabled={submitting}
              onClick={submitWithdrawal}
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </HostPageShell>
  );
}
