'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Gift,
  Share2,
  Users,
  Clock,
  CheckCircle2,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/page-loader';
import { referralApi, type ReferralDashboard } from '@/lib/api/referral';
import { cn } from '@/lib/utils';
import { APP_TITLE } from '@/lib/app-brand';

export default function InvitePage() {
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [applyCode, setApplyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    referralApi
      .me()
      .then(setData)
      .catch(() => toast.error('Failed to load invite data'))
      .finally(() => setLoading(false));
  }, []);

  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined' || !data?.referralCode) return '';
    return `${window.location.origin}/login?redirect=/onboarding&ref=${encodeURIComponent(data.referralCode)}`;
  }, [data?.referralCode]);

  const qrUrl = inviteLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteLink)}`
    : '';

  const copyCode = async () => {
    if (!data?.referralCode) return;
    await navigator.clipboard.writeText(data.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Code copied!');
  };

  const shareInvite = async () => {
    if (!data?.referralCode) return;
    const inviteTitle = APP_TITLE || 'Invite';
    const text = APP_TITLE
      ? `Join me on ${APP_TITLE}! Use code ${data.referralCode} — we both earn coins. ${inviteLink}`
      : `Use my invite code ${data.referralCode} — we both earn coins. ${inviteLink}`;
    if (navigator.share) {
      await navigator.share({ title: `${inviteTitle} Invite`, text, url: inviteLink });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Invite message copied!');
    }
  };

  const apply = async () => {
    try {
      await referralApi.apply(applyCode.trim());
      toast.success('Referral code applied!');
      setApplyCode('');
      const refreshed = await referralApi.me();
      setData(refreshed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid code');
    }
  };

  if (loading || !data) return <PageLoader variant="list" />;

  const { summary, program } = data;

  return (
    <div className="premium-glow-bg min-h-full">
      <div className="relative z-10 mx-auto w-full max-w-[900px] space-y-5 px-4 py-6 pb-12 sm:px-6 sm:py-8 lg:px-10">
        <Link
          href="/settings"
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-[#A7A7B3] transition-colors hover:border-white/20 hover:bg-white/8 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Settings
        </Link>

      <div className="premium-card overflow-hidden border-white/8 bg-[#17171C]/95">
        <div className="gradient-primary p-6">
          <div className="flex items-center gap-2 text-white">
            <Gift className="h-5 w-5" />
            <h1 className="text-xl font-bold">Invite Friends</h1>
          </div>
          <p className="mt-2 text-sm text-white/85">
            Earn {program.inviterRewardCoins} coins per successful invite. Friends get{' '}
            {program.invitedRewardCoins} coins.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#A7A7B3]">
              Your referral code
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={data.referralCode ?? ''}
                className="border-white/10 bg-white/5 font-mono text-lg text-white"
              />
              <Button
                variant="outline"
                className={cn(
                  'border-white/12 bg-white/5 transition-transform',
                  copied && 'scale-95',
                )}
                onClick={copyCode}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-white/12 bg-white/5"
                onClick={shareInvite}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {qrUrl && (
            <div className="flex items-center gap-4 rounded-[20px] border border-white/8 bg-white/5 p-4">
              <img src={qrUrl} alt="Invite QR" className="h-[100px] w-[100px] rounded-lg bg-white p-1" />
              <div>
                <p className="flex items-center gap-1 text-sm font-semibold text-white">
                  <QrCode className="h-4 w-4 text-[#FF6B9D]" />
                  Scan to join
                </p>
                <p className="mt-1 text-xs text-[#A7A7B3]">Share QR at meetups or social posts</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Earnings', value: summary.referralEarningsCoins, suffix: ' coins' },
          { label: 'Successful', value: summary.successfulInvites },
          { label: 'Pending', value: summary.pendingInvites },
          { label: 'Conversion', value: summary.conversionRate, suffix: '%' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="premium-card border-white/8 bg-[#17171C]/90 p-4 text-center"
          >
            <p className="text-2xl font-bold text-white">
              {stat.value}
              {stat.suffix ?? ''}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#A7A7B3]">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {!data.receivedReferral && (
        <div className="premium-card border-white/8 bg-[#17171C]/90 p-5">
          <p className="mb-3 text-sm font-semibold text-white">Have an invite code?</p>
          <div className="flex gap-2">
            <Input
              placeholder="WHO-XXXXXX"
              value={applyCode}
              onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
              className="border-white/10 bg-white/5 font-mono text-white"
            />
            <Button className="gradient-primary border-0" onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      )}

      <div className="premium-card border-white/8 bg-[#17171C]/90 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#A7A7B3]">
          <Users className="h-4 w-4" />
          Invite history
        </h2>
        {data.invites.length === 0 ? (
          <p className="text-sm text-[#A7A7B3]">No invites yet — share your code to get started.</p>
        ) : (
          <div className="space-y-2">
            {data.invites.slice(0, 10).map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-[14px] border border-white/8 bg-white/5 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {invite.referredUser?.displayName ?? 'User'}
                  </p>
                  <p className="text-xs text-[#A7A7B3]">
                    {new Date(invite.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    invite.displayStatus === 'REWARDED' && 'bg-emerald-500/15 text-emerald-400',
                    invite.displayStatus === 'PENDING' && 'bg-amber-500/15 text-amber-400',
                    invite.displayStatus === 'COMPLETED' && 'bg-sky-500/15 text-sky-400',
                    invite.displayStatus === 'CANCELLED' && 'bg-red-500/15 text-red-400',
                  )}
                >
                  {invite.displayStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="premium-card border-white/8 bg-[#17171C]/90 p-4 text-xs text-[#A7A7B3]">
        <p className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          Rewards unlock after your friend completes their first recharge or paid call.
        </p>
        <p className="mt-1 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          One code per account. Fraud checks apply.
        </p>
      </div>
      </div>
    </div>
  );
}