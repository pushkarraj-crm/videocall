'use client';

import Link from 'next/link';
import { Coins } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { Skeleton } from '@/components/ui/skeleton';

export function WalletBadge() {
  const { wallet, isLoading } = useWallet();

  if (isLoading) return <Skeleton className="h-11 w-24 rounded-full" />;

  return (
    <Link
      href="/wallet"
      className="premium-glass flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-white sm:px-4 sm:text-base"
    >
      <Coins className="h-4 w-4 shrink-0 text-[#FFB347] sm:h-5 sm:w-5" />
      {wallet?.balanceCoins?.toFixed(0) ?? '0'}
      {wallet && wallet.freeCallsRemaining > 0 && (
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
          +{wallet.freeCallsRemaining} free
        </span>
      )}
    </Link>
  );
}