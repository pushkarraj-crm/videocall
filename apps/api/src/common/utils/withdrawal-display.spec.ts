import { WithdrawalStatus } from '@prisma/client';
import {
  inrToWithdrawalUnits,
  validateWithdrawalAmount,
  withdrawalDisplayStatus,
  isValidUpiId,
} from './withdrawal-display';

describe('withdrawalDisplayStatus', () => {
  it('maps lifecycle statuses to display labels', () => {
    expect(withdrawalDisplayStatus(WithdrawalStatus.requested)).toBe('PENDING');
    expect(withdrawalDisplayStatus(WithdrawalStatus.processing)).toBe('PENDING');
    expect(withdrawalDisplayStatus(WithdrawalStatus.approved)).toBe('APPROVED');
    expect(withdrawalDisplayStatus(WithdrawalStatus.rejected)).toBe('REJECTED');
    expect(withdrawalDisplayStatus(WithdrawalStatus.completed)).toBe('PAID');
  });
});

describe('inrToWithdrawalUnits', () => {
  it('converts INR to host units', () => {
    expect(inrToWithdrawalUnits(500)).toBe(50000n);
    expect(inrToWithdrawalUnits(4500)).toBe(450000n);
  });
});

describe('validateWithdrawalAmount', () => {
  const minUnits = 50000n;

  it('accepts valid amounts', () => {
    expect(() =>
      validateWithdrawalAmount({
        amountUnits: 100000n,
        withdrawableUnits: 450000n,
        minUnits,
      }),
    ).not.toThrow();
  });

  it('rejects zero and negative amounts', () => {
    expect(() =>
      validateWithdrawalAmount({
        amountUnits: 0n,
        withdrawableUnits: 450000n,
        minUnits,
      }),
    ).toThrow('Amount must be greater than zero');
  });

  it('rejects below minimum', () => {
    expect(() =>
      validateWithdrawalAmount({
        amountUnits: 10000n,
        withdrawableUnits: 450000n,
        minUnits,
      }),
    ).toThrow('Below minimum withdrawal');
  });

  it('rejects over available balance', () => {
    expect(() =>
      validateWithdrawalAmount({
        amountUnits: 500000n,
        withdrawableUnits: 450000n,
        minUnits,
      }),
    ).toThrow('Insufficient withdrawable balance');
  });
});

describe('isValidUpiId', () => {
  it('validates UPI format', () => {
    expect(isValidUpiId('name@upi')).toBe(true);
    expect(isValidUpiId('bad')).toBe(false);
    expect(isValidUpiId('')).toBe(false);
  });
});