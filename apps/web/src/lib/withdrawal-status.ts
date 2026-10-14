export type WithdrawalDisplayStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

const STATUS_MAP: Record<string, WithdrawalDisplayStatus> = {
  requested: 'PENDING',
  processing: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  failed: 'REJECTED',
  completed: 'PAID',
};

export function toWithdrawalDisplayStatus(status: string): WithdrawalDisplayStatus {
  return STATUS_MAP[status] ?? 'PENDING';
}

export const WITHDRAWAL_STATUS_STYLES: Record<WithdrawalDisplayStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  APPROVED: 'bg-blue-500/15 text-blue-400',
  REJECTED: 'bg-red-500/15 text-red-400',
  PAID: 'bg-emerald-500/15 text-emerald-400',
};