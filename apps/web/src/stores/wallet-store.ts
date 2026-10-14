'use client';

import { create } from 'zustand';
import type { WalletSummary } from '@/types/api';
import { walletApi } from '@/lib/api/wallet';

interface WalletState {
  wallet: WalletSummary | null;
  isLoading: boolean;
  fetchWallet: () => Promise<void>;
  setWallet: (wallet: WalletSummary) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  wallet: null,
  isLoading: false,

  fetchWallet: async () => {
    set({ isLoading: true });
    try {
      const wallet = await walletApi.getWallet();
      set({ wallet });
    } catch {
      /* keep last known balance */
    } finally {
      set({ isLoading: false });
    }
  },

  setWallet: (wallet) => set({ wallet }),
}));