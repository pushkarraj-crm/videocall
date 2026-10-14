'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { riskApi } from '@/lib/api/risk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/shared/page-loader';
import { cn } from '@/lib/utils';

const LEVEL_STYLES: Record<string, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/25',
};

type Detail = Awaited<ReturnType<typeof riskApi.detail>>;

export default function AdminRiskDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await riskApi.detail(userId);
    setDetail(data);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  const runAction = async (
    action: string,
    body: Parameters<typeof riskApi.update>[1],
  ) => {
    setActing(action);
    try {
      await riskApi.update(userId, {
        ...body,
        adminNote: adminNote.trim() || body.adminNote,
      });
      toast.success('Risk profile updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  if (loading || !detail) return <PageLoader label="Loading risk profile..." />;

  const profile = detail.profile as {
    aggregateScore?: number;
    riskLevel?: string;
    freezeWithdrawals?: boolean;
    freezeReferralRewards?: boolean;
    freezeCouponRedemption?: boolean;
    requireReKyc?: boolean;
    lastCountry?: string | null;
    lastIp?: string | null;
  };

  const riskLevel = profile.riskLevel ?? 'LOW';
  const score = profile.aggregateScore ?? 0;

  return (
    <div className="premium-glow-bg mx-auto max-w-4xl space-y-6 pb-10">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/admin/risk">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to risk dashboard
        </Link>
      </Button>

      <div className="premium-card border-white/8 bg-[#17171C]/90 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">
              {detail.user.displayName ?? 'User'}
            </h1>
            <p className="mt-1 text-sm text-[#A7A7B3]">
              {detail.user.email ?? detail.user.phone ?? userId}
            </p>
            <p className="mt-1 text-xs text-[#6B6B78]">
              Status: {detail.user.status} · Joined{' '}
              {new Date(detail.user.createdAt).toLocaleDateString('en-IN')}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              LEVEL_STYLES[riskLevel] ?? LEVEL_STYLES.LOW,
            )}
          >
            {riskLevel} · Score {score}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Toggle label="Freeze Withdrawals" active={!!profile.freezeWithdrawals} />
          <Toggle label="Freeze Referrals" active={!!profile.freezeReferralRewards} />
          <Toggle label="Freeze Coupons" active={!!profile.freezeCouponRedemption} />
          <Toggle label="Re-KYC Required" active={!!profile.requireReKyc} />
        </div>

        {profile.lastCountry && (
          <p className="mt-3 text-xs text-[#6B6B78]">
            Last seen: {profile.lastCountry}
            {profile.lastIp ? ' · IP masked' : ''}
          </p>
        )}
      </div>

      <div className="premium-card border-white/8 bg-[#17171C]/90 p-5">
        <h2 className="mb-3 text-sm font-semibold">Admin Actions</h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="note">Admin note</Label>
            <Input
              id="note"
              className="mt-1"
              placeholder="Investigation notes..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionBtn
              label="Mark Safe"
              acting={acting}
              action="markSafe"
              onClick={() => runAction('markSafe', { markSafe: true })}
            />
            <ActionBtn
              label="Freeze Withdrawals"
              acting={acting}
              action="freezeWd"
              variant="outline"
              onClick={() => runAction('freezeWd', { freezeWithdrawals: true })}
            />
            <ActionBtn
              label="Freeze Referrals"
              acting={acting}
              action="freezeRef"
              variant="outline"
              onClick={() => runAction('freezeRef', { freezeReferralRewards: true })}
            />
            <ActionBtn
              label="Freeze Coupons"
              acting={acting}
              action="freezeCpn"
              variant="outline"
              onClick={() => runAction('freezeCpn', { freezeCouponRedemption: true })}
            />
            <ActionBtn
              label="Request Re-KYC"
              acting={acting}
              action="rekyc"
              variant="outline"
              onClick={() => runAction('rekyc', { requireReKyc: true })}
            />
            <ActionBtn
              label="Suspend Account"
              acting={acting}
              action="suspend"
              variant="destructive"
              onClick={() => runAction('suspend', { suspendAccount: true })}
            />
            <ActionBtn
              label="Unsuspend"
              acting={acting}
              action="unsuspend"
              variant="outline"
              onClick={() => runAction('unsuspend', { unsuspendAccount: true })}
            />
          </div>
        </div>
      </div>

      {detail.flags && detail.flags.length > 0 && (
        <div className="premium-card border-white/8 bg-[#17171C]/90 p-5">
          <h2 className="mb-3 text-sm font-semibold">Fraud Flags</h2>
          <div className="space-y-2">
            {detail.flags.map((f: { id: string; type: string; status: string; riskScore: number; reason: string | null }) => (
              <div key={f.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{f.type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground">{f.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Score {f.riskScore} · {f.reason ?? 'No reason'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.timeline && detail.timeline.length > 0 && (
        <div className="premium-card border-white/8 bg-[#17171C]/90 p-5">
          <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
          <div className="space-y-2">
            {detail.timeline.map(
              (
                item: {
                  kind: string;
                  at: string;
                  title: string;
                  score?: number;
                  level?: string | null;
                  reason?: string | null;
                },
                i: number,
              ) => (
                <div key={`${item.at}-${i}`} className="flex gap-3 text-sm">
                  <div className="w-36 shrink-0 text-xs text-muted-foreground">
                    {new Date(item.at).toLocaleString('en-IN')}
                  </div>
                  <div className="flex-1 rounded-xl bg-white/5 px-3 py-2">
                    <p className="font-medium">
                      {item.kind}: {item.title}
                      {item.score != null ? ` (${item.score})` : ''}
                    </p>
                    {item.reason && (
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {detail.devices && detail.devices.length > 0 && (
        <div className="premium-card border-white/8 bg-[#17171C]/90 p-5">
          <h2 className="mb-3 text-sm font-semibold">Devices</h2>
          <div className="space-y-2">
            {detail.devices.map(
              (
                d: {
                  fingerprintHash: string;
                  platform: string | null;
                  os: string | null;
                  lastCountry: string | null;
                },
                i: number,
              ) => (
                <div key={i} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                  <p className="font-mono text-xs">{d.fingerprintHash}</p>
                  <p className="text-xs text-muted-foreground">
                    {[d.platform, d.os, d.lastCountry].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl px-3 py-2 text-xs font-medium',
        active ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-muted-foreground',
      )}
    >
      {label}: {active ? 'ON' : 'OFF'}
    </div>
  );
}

function ActionBtn({
  label,
  acting,
  action,
  onClick,
  variant = 'default',
}: {
  label: string;
  acting: string | null;
  action: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive';
}) {
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={acting !== null}
      onClick={onClick}
    >
      {acting === action ? '…' : label}
    </Button>
  );
}