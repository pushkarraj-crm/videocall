import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletTransactionType } from '@prisma/client';
import { unitsToCoins } from '../../common/constants/coins';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';

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
      items: items.map((tx) => ({
        ...tx,
        amountUnits: tx.amountUnits.toString(),
        balanceAfterUnits: tx.balanceAfterUnits.toString(),
        amountCoins: unitsToCoins(tx.amountUnits),
      })),
      total,
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

      return tx.walletTransaction.create({
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

      return tx.walletTransaction.create({
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
    });
  }
}