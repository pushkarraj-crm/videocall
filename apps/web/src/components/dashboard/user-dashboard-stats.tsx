'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, Gift, Clock, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { COINS_PER_MINUTE, FREE_CALL_LIMIT } from '@/lib/constants';
import { coinsToMinutes } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import { referralsApi } from '@/lib/api/referrals';
import { Skeleton } from '@/components/ui/skeleton';

export function UserDashboardStats() {
  const { wallet, isLoading } = useWallet();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    referralsApi
      .getMe()
      .then((d) => setReferralCode(d.referralCode ?? null))
      .catch(() => {});
  }, []);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  const coins = wallet?.balanceCoins ?? 0;
  const minutes = coinsToMinutes(coins, COINS_PER_MINUTE);
  const freeUsed = wallet?.freeCallsUsed ?? 0;
  const freeRemaining = wallet?.freeCallsRemaining ?? FREE_CALL_LIMIT;

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="gradient-primary p-4 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Wallet Balance</p>
              <p className="text-3xl font-bold">{coins.toFixed(0)} coins</p>
              <p className="text-sm opacity-80">≈ {minutes} minutes talk time</p>
            </div>
            <Coins className="h-10 w-10 opacity-80" />
          </div>
        </div>
        <CardContent className="grid grid-cols-3 gap-2 p-3">
          <Link
            href="/wallet/purchase"
            className="rounded-xl bg-secondary p-2 text-center text-xs hover:bg-secondary/80"
          >
            <Coins className="mx-auto h-4 w-4 text-primary" />
            Recharge
          </Link>
          <Link
            href="/referrals"
            className="rounded-xl bg-secondary p-2 text-center text-xs hover:bg-secondary/80"
          >
            <Gift className="mx-auto h-4 w-4 text-primary" />
            Refer
          </Link>
          <Link
            href="/calls/history"
            className="rounded-xl bg-secondary p-2 text-center text-xs hover:bg-secondary/80"
          >
            <Phone className="mx-auto h-4 w-4 text-primary" />
            History
          </Link>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-primary" />
              Free calls
            </span>
            <span className="font-medium">{freeRemaining} left</span>
          </div>
          <Progress
            value={((FREE_CALL_LIMIT - freeRemaining) / FREE_CALL_LIMIT) * 100}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {freeUsed}/{FREE_CALL_LIMIT} used
          </p>
        </CardContent>
      </Card>

      {referralCode && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Your referral code</p>
            <p className="font-mono font-semibold text-primary">{referralCode}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}