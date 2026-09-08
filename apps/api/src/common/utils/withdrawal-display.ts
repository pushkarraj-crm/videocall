import { WithdrawalStatus } from '@prisma/client';

export type WithdrawalDisplayStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export function withdrawalDisplayStatus(status: WithdrawalStatus): WithdrawalDisplayStatus {
  switch (status) {
    case WithdrawalStatus.requested:
    case WithdrawalStatus.processing:
      return 'PENDING';
    case WithdrawalStatus.approved:
      return 'APPROVED';
    case WithdrawalStatus.rejected:
    case WithdrawalStatus.failed:
      return 'REJECTED';
    case WithdrawalStatus.completed:
      return 'PAID';
    default:
      return 'PENDING';
  }
}

export function inrToWithdrawalUnits(amountInr: number): bigint {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  return BigInt(Math.round(amountInr * 100));
}

export function validateWithdrawalAmount(params: {
  amountUnits: bigint;
  withdrawableUnits: bigint;
  minUnits: bigint;
}): void {
  const { amountUnits, withdrawableUnits, minUnits } = params;

  if (amountUnits <= 0n) {
    throw new Error('Amount must be greater than zero');
  }
  if (amountUnits < minUnits) {
    throw new Error('Below minimum withdrawal');
  }
  if (amountUnits > withdrawableUnits) {
    throw new Error('Insufficient withdrawable balance');
  }
}

export function isValidUpiId(upiId: string): boolean {
  const trimmed = upiId.trim();
  return trimmed.length >= 5 && trimmed.length <= 128 && trimmed.includes('@');
}