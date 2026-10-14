'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageLoader } from '@/components/shared/page-loader';
import { adminApi, type AdminUserDetail } from '@/lib/api/admin';
import { cn, formatInr } from '@/lib/utils';

type HistoryType = 'recharges' | 'calls' | 'withdrawals' | 'admin_logs';

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [note, setNote] = useState('');
  const [historyType, setHistoryType] = useState<HistoryType>('recharges');
  const [history, setHistory] = useState<{ items: Record<string, unknown>[]; total: number } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUser = useCallback(async () => {
    const detail = await adminApi.getUser(userId);
    setUser(detail);
    setNote(detail.adminNote ?? '');
  }, [userId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await adminApi.getUserHistory(userId, historyType, 1);
      setHistory(res as { items: Record<string, unknown>[]; total: number });
    } finally {
      setHistoryLoading(false);
    }
  }, [userId, historyType]);

  useEffect(() => {
    loadUser().catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load user'));
  }, [loadUser]);

  useEffect(() => {
    loadHistory().catch(() => setHistory(null));
  }, [loadHistory]);

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setActionLoading(true);
    try {
      await fn();
      toast.success(label);
      await loadUser();
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (!user) return <PageLoader label="Loading user profile..." />;

  const isHost = user.roles.includes('host');

  return (
    <div className="premium-glow-bg min-h-full space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="border-white/10" asChild>
          <Link href="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
        </Button>
        <h1 className="text-2xl font-bold text-white">User Profile</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-2xl">{user.displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-bold text-white">{user.displayName}</h2>
            <p className="text-sm text-[#A7A7B3]">{user.id}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {user.roles.map((r) => (
                <span key={r} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white">{r}</span>
              ))}
            </div>
            <p className="mt-3 text-sm capitalize text-[#A7A7B3]">Status: <span className="text-white">{user.status}</span></p>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <div><span className="text-[#A7A7B3]">Email:</span> <span className="text-white">{user.email ?? '—'}</span></div>
            <div><span className="text-[#A7A7B3]">Phone:</span> <span className="text-white">{user.phone ?? '—'}</span></div>
            <div><span className="text-[#A7A7B3]">Joined:</span> <span className="text-white">{new Date(user.createdAt).toLocaleString('en-IN')}</span></div>
            <div><span className="text-[#A7A7B3]">Last seen:</span> <span className="text-white">{user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString('en-IN') : '—'}</span></div>
            <div><span className="text-[#A7A7B3]">Device:</span> <span className="text-white">{user.device?.platform ?? user.deviceFingerprint ?? '—'}</span></div>
            <div><span className="text-[#A7A7B3]">Free calls used:</span> <span className="text-white">{user.freeCallsUsed}</span></div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4">
              <div className="flex items-center gap-2 text-[#A7A7B3]"><Wallet className="h-4 w-4" /> Wallet</div>
              <p className="mt-2 text-2xl font-bold text-white">{user.wallet?.balanceCoins ?? 0} coins</p>
              <p className="text-xs text-[#A7A7B3]">Lifetime credited: {user.wallet?.lifetimeCreditedCoins ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4">
              <div className="flex items-center gap-2 text-[#A7A7B3]"><Shield className="h-4 w-4" /> KYC</div>
              <p className="mt-2 text-2xl font-bold text-white">{user.kyc.status}</p>
              {user.kyc.adminNote && <p className="text-xs text-[#A7A7B3]">{user.kyc.adminNote}</p>}
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4">
              <p className="text-xs uppercase tracking-wider text-[#A7A7B3]">Total Recharge</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatInr(user.stats.totalRechargeInr)}</p>
              <p className="text-xs text-[#A7A7B3]">{user.stats.rechargeCount} payments</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4">
              <p className="text-xs uppercase tracking-wider text-[#A7A7B3]">Calls</p>
              <p className="mt-2 text-2xl font-bold text-white">{user.stats.totalCalls}</p>
              <p className="text-xs text-[#A7A7B3]">{user.stats.totalMinutes} minutes</p>
            </div>
          </div>

          {isHost && user.host && (
            <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4">
              <h3 className="font-semibold text-white">Host Controls</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-[#A7A7B3]">
                <p>Online: <span className="text-white">{user.host.status}</span></p>
                <p>Earnings: <span className="text-white">{user.host.totalEarningsCoins} coins</span></p>
                <p>Withdrawable: <span className="text-white">{user.host.withdrawableCoins} coins</span></p>
                <p>Withdrawn: <span className="text-white">{formatInr(user.stats.totalWithdrawnInr)}</span></p>
                <p>Calls disabled: <span className="text-white">{user.host.adminCallsDisabled ? 'Yes' : 'No'}</span></p>
                <p>Withdrawals disabled: <span className="text-white">{user.host.adminWithdrawalsDisabled ? 'Yes' : 'No'}</span></p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="border-white/10" disabled={actionLoading}
                  onClick={() => runAction('Host forced offline', () => adminApi.forceOffline(userId))}>
                  Force Offline
                </Button>
                <Button size="sm" variant="outline" className="border-white/10" disabled={actionLoading}
                  onClick={() => runAction(
                    user.host!.adminCallsDisabled ? 'Calls enabled' : 'Calls disabled',
                    () => adminApi.updateHostControls(userId, { callsDisabled: !user.host!.adminCallsDisabled }),
                  )}>
                  {user.host.adminCallsDisabled ? 'Enable Calls' : 'Disable Calls'}
                </Button>
                <Button size="sm" variant="outline" className="border-white/10" disabled={actionLoading}
                  onClick={() => runAction(
                    user.host!.adminWithdrawalsDisabled ? 'Withdrawals enabled' : 'Withdrawals disabled',
                    () => adminApi.updateHostControls(userId, { withdrawalsDisabled: !user.host!.adminWithdrawalsDisabled }),
                  )}>
                  {user.host.adminWithdrawalsDisabled ? 'Enable Withdrawals' : 'Disable Withdrawals'}
                </Button>
                {user.kyc.id && (
                  <Button size="sm" variant="outline" className="border-white/10" asChild>
                    <Link href="/admin/kyc">View KYC</Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4">
            <h3 className="font-semibold text-white">Admin Actions</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.status !== 'suspended' ? (
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" disabled={actionLoading}
                  onClick={() => runAction('User suspended', () => adminApi.suspendUser(userId, note || 'Suspended by admin'))}>
                  Suspend
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-white/10" disabled={actionLoading}
                  onClick={() => runAction('User unsuspended', () => adminApi.unsuspendUser(userId))}>
                  Unsuspend
                </Button>
              )}
              {user.status !== 'banned' ? (
                <Button size="sm" className="bg-red-600 hover:bg-red-700" disabled={actionLoading}
                  onClick={() => runAction('User blocked', () => adminApi.blockUser(userId, note || 'Blocked by admin'))}>
                  Block
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-white/10" disabled={actionLoading}
                  onClick={() => runAction('User unblocked', () => adminApi.unblockUser(userId))}>
                  Unblock
                </Button>
              )}
              <Button size="sm" variant="outline" className="border-white/10" disabled={actionLoading}
                onClick={() => runAction('Sessions revoked', () => adminApi.forceLogout(userId))}>
                Force Logout
              </Button>
              <Button size="sm" variant="outline" className="border-white/10" disabled={actionLoading}
                onClick={() => runAction('Free calls reset', () => adminApi.resetFreeCalls(userId))}>
                Reset Free Calls
              </Button>
            </div>

            <div className="mt-4">
              <label className="text-xs text-[#A7A7B3]">Admin note</label>
              <div className="mt-1 flex gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Spam, Fake KYC, Abusive Behaviour..."
                  className="border-white/10 bg-white/5" />
                <Button disabled={actionLoading}
                  onClick={() => runAction('Note saved', () => adminApi.updateUserNote(userId, note))}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {(['recharges', 'calls', 'withdrawals', 'admin_logs'] as HistoryType[]).map((type) => (
            <Button key={type} size="sm"
              variant={historyType === type ? 'default' : 'outline'}
              className={cn(historyType === type ? 'gradient-primary border-0' : 'border-white/10')}
              onClick={() => setHistoryType(type)}>
              {type.replace('_', ' ')}
            </Button>
          ))}
        </div>

        {historyLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !history || history.items.length === 0 ? (
          <p className="py-8 text-center text-[#A7A7B3]">No history records</p>
        ) : (
          <div className="divide-y divide-white/5">
            {history.items.map((item, idx) => (
              <pre key={idx} className="overflow-x-auto py-3 text-xs text-[#A7A7B3]">
                {JSON.stringify(item, null, 2)}
              </pre>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}