import { apiClient } from './client';
import type { WalletSummary } from '@/types/api';

export interface LedgerEntry {
  id: string;
  type: string;
  amountUnits: string;
  amountCoins: number;
  description: string;
  status?: string;
  createdAt: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

const LEDGER_TYPE_LABELS: Record<string, string> = {
  payment_credit: 'Recharge',
  gift_send: 'Gift Sent',
  gift_receive: 'Gift Received',
  call_charge: 'Call Charge',
  call_earning: 'Call Earning',
  withdrawal: 'Withdrawal',
  refund: 'Refund',
};

export function ledgerTypeLabel(type: string, description?: string): string {
  if (description?.startsWith('Recharge ₹')) return description;
  return LEDGER_TYPE_LABELS[type] ?? type;
}

export const walletApi = {
  getWallet: () => apiClient<WalletSummary>('/wallet'),
  getTransactions: (page = 1, limit = 20) =>
    apiClient<{ items: unknown[]; total: number; page: number; limit: number }>(
      `/wallet/transactions?page=${page}&limit=${limit}`,
    ),
  getLedger: (page = 1, limit = 50) =>
    apiClient<{ items: LedgerEntry[]; total: number; page: number; limit: number }>(
      `/wallet/ledger?page=${page}&limit=${limit}`,
    ),
  validate: () =>
    apiClient<{ consistent: boolean; balanceUnits: string; transactionSum: string }>(
      '/wallet/validate',
    ),
};