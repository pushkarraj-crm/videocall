import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletTransactionType } from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { assertWalletConsistent } from './wallet-consistency';

export type LedgerEntryType =
  | 'payment_credit'
  | 'gift_send'
  | 'gift_receive'
  | 'call_charge'
  | 'call_earning'
  | 'withdrawal'
  | 'refund';

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  amountUnits: string;
  amountCoins: number;
  description: string;
  status?: string;
  createdAt: Date;
  referenceType?: string | null;
  referenceId?: string | null;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async ensureWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async getWalletSummary(userId: string) {
    const wallet = await this.ensureWallet(userId);
    const freeCallLimit = this.config.get<number>('FREE_CALL_LIMIT', 5);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return {
      balanceUnits: wallet.balanceUnits.toString(),
      balanceCoins: unitsToCoins(wallet.balanceUnits),
      lockedUnits: wallet.lockedUnits.toString(),
      freeCallsUsed: user?.freeCallsUsed ?? 0,
      freeCallsRemaining: Math.max(0, freeCallLimit - (user?.freeCallsUsed ?? 0)),
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.ensureWallet(userId);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      items: items.map((tx) => this.serializeTransaction(tx)),
      total,
      page,
      limit,
    };
  }

  async getLedger(userId: string, page = 1, limit = 50) {
    const wallet = await this.ensureWallet(userId);

    const [walletTxs, hostEarnings, withdrawals] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.hostEarning.findMany({
        where: { hostId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.withdrawal.findMany({
        where: { hostId: userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const entries: LedgerEntry[] = [];

    for (const tx of walletTxs) {
      const type = this.mapWalletTxType(tx.type);
      if (!type) continue;

      entries.push({
        id: tx.id,
        type,
        amountUnits: tx.amountUnits.toString(),
        amountCoins: unitsToCoins(tx.amountUnits),
        description: tx.description ?? this.defaultLedgerDescription(type),
        createdAt: tx.createdAt,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
      });
    }

    for (const earning of hostEarnings) {
      const type: LedgerEntryType = earning.billingTickId ? 'call_earning' : 'gift_receive';
      entries.push({
        id: earning.id,
        type,
        amountUnits: earning.netUnits.toString(),
        amountCoins: unitsToCoins(earning.netUnits),
        description: type === 'gift_receive' ? 'Gift received' : 'Call earning',
        status: earning.status,
        createdAt: earning.createdAt,
        referenceType: 'call',
        referenceId: earning.callId,
      });
    }

    for (const withdrawal of withdrawals) {
      entries.push({
        id: withdrawal.id,
        type: 'withdrawal',
        amountUnits: (-withdrawal.amountUnits).toString(),
        amountCoins: -unitsToCoins(withdrawal.amountUnits),
        description: 'Withdrawal request',
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
        referenceType: 'withdrawal',
        referenceId: withdrawal.id,
      });
    }

    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const skip = (page - 1) * limit;
    const items = entries.slice(skip, skip + limit);

    return {
      items,
      total: entries.length,
      page,
      limit,
    };
  }

  async creditWallet(params: {
    userId: string;
    amountUnits: bigint;
    type: WalletTransactionType;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey: string;
    description?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return existing;

      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: params.userId },
      });

      const newBalance = wallet.balanceUnits + params.amountUnits;

      const updated = await tx.wallet.update({
        where: { id: wallet.id, version: wallet.version },
        data: {
          balanceUnits: newBalance,
          lifetimeCreditedUnits: wallet.lifetimeCreditedUnits + params.amountUnits,
          version: { increment: 1 },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: updated.id,
          userId: params.userId,
          type: params.type,
          amountUnits: params.amountUnits,
          balanceAfterUnits: newBalance,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
        },
      });

      await assertWalletConsistent(tx, updated.id);
      return transaction;
    });
  }

  async debitWallet(params: {
    userId: string;
    amountUnits: bigint;
    type: WalletTransactionType;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey: string;
    description?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return existing;

      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: params.userId },
      });

      if (wallet.balanceUnits < params.amountUnits) {
        throw new BusinessException('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
      }

      const newBalance = wallet.balanceUnits - params.amountUnits;

      const updated = await tx.wallet.update({
        where: { id: wallet.id, version: wallet.version },
        data: {
          balanceUnits: newBalance,
          lifetimeDebitedUnits: wallet.lifetimeDebitedUnits + params.amountUnits,
          version: { increment: 1 },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: updated.id,
          userId: params.userId,
          type: params.type,
          amountUnits: -params.amountUnits,
          balanceAfterUnits: newBalance,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
        },
      });

      await assertWalletConsistent(tx, updated.id);
      return transaction;
    });
  }

  async recordLedgerEntry(params: {
    userId: string;
    amountUnits: bigint;
    type: WalletTransactionType;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey: string;
    description?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return existing;

      const wallet = await tx.wallet.upsert({
        where: { userId: params.userId },
        update: {},
        create: { userId: params.userId },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: params.userId,
          type: params.type,
          amountUnits: params.amountUnits,
          balanceAfterUnits: wallet.balanceUnits,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
        },
      });

      await assertWalletConsistent(tx, wallet.id);
      return transaction;
    });
  }

  async validateWalletBalance(userId: string): Promise<{
    consistent: boolean;
    balanceUnits: string;
    transactionSum: string;
    lifetimeDelta: string;
  }> {
    const wallet = await this.ensureWallet(userId);

    const aggregates = await this.prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        type: {
          in: [
            WalletTransactionType.payment_credit,
            WalletTransactionType.call_charge,
            WalletTransactionType.gift_send,
            WalletTransactionType.referral_bonus,
            WalletTransactionType.refund,
            WalletTransactionType.admin_adjustment,
            WalletTransactionType.payout_reversal,
          ],
        },
      },
      _sum: { amountUnits: true },
    });

    const txSum = aggregates._sum.amountUnits ?? 0n;
    const lifetimeDelta = wallet.lifetimeCreditedUnits - wallet.lifetimeDebitedUnits;
    const consistent =
      txSum === wallet.balanceUnits && lifetimeDelta === wallet.balanceUnits;

    return {
      consistent,
      balanceUnits: wallet.balanceUnits.toString(),
      transactionSum: txSum.toString(),
      lifetimeDelta: lifetimeDelta.toString(),
    };
  }

  private mapWalletTxType(type: WalletTransactionType): LedgerEntryType | null {
    switch (type) {
      case WalletTransactionType.payment_credit:
        return 'payment_credit';
      case WalletTransactionType.gift_send:
        return 'gift_send';
      case WalletTransactionType.call_charge:
        return 'call_charge';
      case WalletTransactionType.gift_receive:
        return 'gift_receive';
      case WalletTransactionType.call_earning:
        return 'call_earning';
      case WalletTransactionType.withdrawal:
        return 'withdrawal';
      case WalletTransactionType.refund:
        return 'refund';
      default:
        return null;
    }
  }

  private defaultLedgerDescription(type: LedgerEntryType): string {
    const labels: Record<LedgerEntryType, string> = {
      payment_credit: 'Recharge',
      gift_send: 'Gift Sent',
      gift_receive: 'Gift Received',
      call_charge: 'Call Charge',
      call_earning: 'Call Earning',
      withdrawal: 'Withdrawal',
      refund: 'Refund',
    };
    return labels[type];
  }

  private serializeTransaction(tx: {
    id: string;
    type: WalletTransactionType;
    amountUnits: bigint;
    balanceAfterUnits: bigint;
    referenceType: string | null;
    referenceId: string | null;
    description: string | null;
    createdAt: Date;
  }) {
    return {
      ...tx,
      amountUnits: tx.amountUnits.toString(),
      balanceAfterUnits: tx.balanceAfterUnits.toString(),
      amountCoins: unitsToCoins(tx.amountUnits),
    };
  }
}