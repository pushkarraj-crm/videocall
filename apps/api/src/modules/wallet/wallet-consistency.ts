import { InternalServerErrorException } from '@nestjs/common';
import { Prisma, WalletTransactionType } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

export const BALANCE_AFFECTING_TX_TYPES: WalletTransactionType[] = [
  WalletTransactionType.payment_credit,
  WalletTransactionType.call_charge,
  WalletTransactionType.gift_send,
  WalletTransactionType.referral_bonus,
  WalletTransactionType.refund,
  WalletTransactionType.admin_adjustment,
  WalletTransactionType.payout_reversal,
];

export async function assertWalletConsistent(
  tx: TxClient,
  walletId: string,
): Promise<void> {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });

  const aggregates = await tx.walletTransaction.aggregate({
    where: {
      walletId,
      type: { in: BALANCE_AFFECTING_TX_TYPES },
    },
    _sum: { amountUnits: true },
  });

  const txSum = aggregates._sum.amountUnits ?? 0n;
  if (txSum !== wallet.balanceUnits) {
    throw new InternalServerErrorException({
      code: 'WALLET_INCONSISTENT',
      message: `Wallet balance ${wallet.balanceUnits} does not match transaction sum ${txSum}`,
    });
  }

  const expectedBalance =
    wallet.lifetimeCreditedUnits - wallet.lifetimeDebitedUnits;
  if (expectedBalance !== wallet.balanceUnits) {
    throw new InternalServerErrorException({
      code: 'WALLET_LIFETIME_MISMATCH',
      message: `Wallet balance ${wallet.balanceUnits} does not match lifetime credits-debits ${expectedBalance}`,
    });
  }

  const lastBalanceTx = await tx.walletTransaction.findFirst({
    where: {
      walletId,
      type: { in: BALANCE_AFFECTING_TX_TYPES },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (lastBalanceTx && lastBalanceTx.balanceAfterUnits !== wallet.balanceUnits) {
    throw new InternalServerErrorException({
      code: 'WALLET_LAST_TX_MISMATCH',
      message: `Wallet balance ${wallet.balanceUnits} does not match last tx balance ${lastBalanceTx.balanceAfterUnits}`,
    });
  }
}