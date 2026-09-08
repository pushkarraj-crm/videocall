import { InternalServerErrorException } from '@nestjs/common';
import { WalletTransactionType } from '@prisma/client';
import { assertWalletConsistent } from './wallet-consistency';

function createMockTx(
  wallet: {
    id: string;
    balanceUnits: bigint;
    lifetimeCreditedUnits: bigint;
    lifetimeDebitedUnits: bigint;
  },
  transactions: Array<{
    amountUnits: bigint;
    balanceAfterUnits: bigint;
    type?: WalletTransactionType;
    createdAt?: Date;
  }>,
) {
  const txs = transactions.map((t, i) => ({
    amountUnits: t.amountUnits,
    balanceAfterUnits: t.balanceAfterUnits,
    type: t.type ?? WalletTransactionType.payment_credit,
    createdAt: t.createdAt ?? new Date(i),
  }));

  const balanceTypes = new Set([
    WalletTransactionType.payment_credit,
    WalletTransactionType.call_charge,
    WalletTransactionType.gift_send,
    WalletTransactionType.referral_bonus,
    WalletTransactionType.refund,
    WalletTransactionType.admin_adjustment,
    WalletTransactionType.payout_reversal,
  ]);

  const balanceTypeList = [...balanceTypes];
  const balanceTxs = txs.filter((t) =>
    balanceTypeList.includes(t.type as (typeof balanceTypeList)[number]),
  );

  return {
    wallet: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(wallet),
    },
    walletTransaction: {
      aggregate: jest.fn().mockImplementation(({ where }) => {
        const filtered = where?.type?.in
          ? txs.filter((t) => where.type.in.includes(t.type))
          : balanceTxs;
        return Promise.resolve({
          _sum: {
            amountUnits: filtered.reduce((s, t) => s + t.amountUnits, 0n),
          },
        });
      }),
      findFirst: jest.fn().mockResolvedValue(
        balanceTxs.length > 0 ? balanceTxs[balanceTxs.length - 1] : null,
      ),
    },
  };
}

describe('assertWalletConsistent', () => {
  const wallet = {
    id: 'wallet-1',
    balanceUnits: 10000n,
    lifetimeCreditedUnits: 15000n,
    lifetimeDebitedUnits: 5000n,
  };

  it('passes when balance matches balance-affecting transaction sum', async () => {
    const tx = createMockTx(wallet, [
      { amountUnits: 15000n, balanceAfterUnits: 15000n, type: WalletTransactionType.payment_credit },
      { amountUnits: -5000n, balanceAfterUnits: 10000n, type: WalletTransactionType.gift_send },
      { amountUnits: 350n, balanceAfterUnits: 10000n, type: WalletTransactionType.call_earning },
    ]);

    await expect(assertWalletConsistent(tx as never, wallet.id)).resolves.toBeUndefined();
  });

  it('throws when balance-affecting sum does not match balance', async () => {
    const tx = createMockTx(wallet, [{ amountUnits: 5000n, balanceAfterUnits: 5000n }]);

    await expect(assertWalletConsistent(tx as never, wallet.id)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws when lifetime credited-debited does not match balance', async () => {
    const inconsistentWallet = {
      ...wallet,
      lifetimeCreditedUnits: 20000n,
    };
    const tx = createMockTx(inconsistentWallet, [
      { amountUnits: 15000n, balanceAfterUnits: 15000n, type: WalletTransactionType.payment_credit },
      { amountUnits: -5000n, balanceAfterUnits: 10000n, type: WalletTransactionType.gift_send },
    ]);

    await expect(
      assertWalletConsistent(tx as never, inconsistentWallet.id),
    ).rejects.toThrow(InternalServerErrorException);
  });
});