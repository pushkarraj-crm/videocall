'use client';

import { useEffect } from 'react';
import { useWalletStore } from '@/stores/wallet-store';
import { useAuthStore } from '@/stores/auth-store';

export function useWallet() {
  const { wallet, fetchWallet, isLoading } = useWalletStore();
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (session) fetchWallet();
  }, [session, fetchWallet]);

  return { wallet, fetchWallet, isLoading, balanceCoins: wallet?.balanceCoins ?? 0 };
}