import { Injectable } from '@nestjs/common';
import { WalletTransactionType } from '@prisma/client';
import { coinsToUnits, unitsToCoins } from '../../common/constants/coins';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateCoinPackageDto, UpdateCoinPackageDto } from './dto/coin-package.dto';
import { WalletAdjustDto } from './dto/wallet-adjust.dto';

@Injectable()
export class AdminWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async getOverview() {
    const [wallets, txCount, totalBalance] = await Promise.all([
      this.prisma.wallet.count(),
      this.prisma.walletTransaction.count(),
      this.prisma.wallet.aggregate({ _sum: { balanceUnits: true } }),
    ]);

    return {
      walletCount: wallets,
      transactionCount: txCount,
      totalBalanceCoins: unitsToCoins(totalBalance._sum.balanceUnits ?? 0n),
    };
  }

  async listTransactions(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, displayName: true, email: true, phone: true } },
        },
      }),
      this.prisma.walletTransaction.count(),
    ]);

    return {
      items: items.map((tx) => ({
        id: tx.id,
        userId: tx.userId,
        user: tx.user,
        type: tx.type,
        amountCoins: unitsToCoins(tx.amountUnits),
        balanceAfterCoins: unitsToCoins(tx.balanceAfterUnits),
        description: tx.description,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async adjustWallet(adminId: string, userId: string, dto: WalletAdjustDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }

    await this.wallet.ensureWallet(userId);
    const amountUnits = coinsToUnits(dto.amountCoins);
    const reason = dto.reason?.trim() || `Admin ${dto.action}`;
    const idempotencyKey = `admin:${adminId}:${userId}:${dto.action}:${Date.now()}`;

    if (dto.action === 'debit') {
      await this.wallet.debitWallet({
        userId,
        amountUnits,
        type: WalletTransactionType.admin_adjustment,
        referenceType: 'admin_adjustment',
        referenceId: adminId,
        idempotencyKey,
        description: reason,
      });
    } else {
      const type =
        dto.action === 'refund'
          ? WalletTransactionType.refund
          : WalletTransactionType.admin_adjustment;
      await this.wallet.creditWallet({
        userId,
        amountUnits,
        type,
        referenceType: 'admin_adjustment',
        referenceId: adminId,
        idempotencyKey,
        description: reason,
      });
    }

    return this.wallet.getWalletSummary(userId);
  }

  async listPackages() {
    return this.prisma.coinPackage.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createPackage(dto: CreateCoinPackageDto) {
    return this.prisma.coinPackage.create({
      data: {
        name: dto.name,
        priceInr: dto.priceInr,
        mrpInr: dto.mrpInr ?? dto.priceInr,
        coinUnits: BigInt(dto.coinUnits),
        bonusUnits: BigInt(dto.bonusUnits ?? 0),
        isBestValue: dto.isBestValue ?? false,
        isMostPopular: dto.isMostPopular ?? false,
        isLimitedOffer: dto.isLimitedOffer ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePackage(id: string, dto: UpdateCoinPackageDto) {
    const existing = await this.prisma.coinPackage.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new BusinessException('Package not found', 404, 'PACKAGE_NOT_FOUND');
    }

    return this.prisma.coinPackage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.priceInr !== undefined ? { priceInr: dto.priceInr } : {}),
        ...(dto.mrpInr !== undefined ? { mrpInr: dto.mrpInr } : {}),
        ...(dto.coinUnits !== undefined ? { coinUnits: BigInt(dto.coinUnits) } : {}),
        ...(dto.bonusUnits !== undefined ? { bonusUnits: BigInt(dto.bonusUnits) } : {}),
        ...(dto.isBestValue !== undefined ? { isBestValue: dto.isBestValue } : {}),
        ...(dto.isMostPopular !== undefined ? { isMostPopular: dto.isMostPopular } : {}),
        ...(dto.isLimitedOffer !== undefined ? { isLimitedOffer: dto.isLimitedOffer } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}