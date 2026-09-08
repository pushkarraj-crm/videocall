import { Body, Controller, Get, Inject, Post, Query, forwardRef } from '@nestjs/common';
import { Role, WalletTransactionType } from '@prisma/client';
import { coinsToUnits } from '../../common/constants/coins';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PaymentsService } from '../payments/payments.service';
import { WalletDeductDto } from './dto/wallet-deduct.dto';
import { WalletRechargeDto } from './dto/wallet-recharge.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  getWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getWalletSummary(user.id);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactions(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getLedger(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('ledger')
  getLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getLedger(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('recharge')
  recharge(@CurrentUser() user: AuthenticatedUser, @Body() dto: WalletRechargeDto) {
    return this.payments.createOrder(user.id, dto.packageId, dto.customCoins);
  }

  @Post('deduct')
  @Roles(Role.admin, Role.super_admin)
  async deduct(@CurrentUser() admin: AuthenticatedUser, @Body() dto: WalletDeductDto) {
    await this.walletService.debitWallet({
      userId: dto.userId,
      amountUnits: coinsToUnits(dto.amountCoins),
      type: WalletTransactionType.admin_adjustment,
      referenceType: 'admin_deduct',
      referenceId: admin.id,
      idempotencyKey: `admin:deduct:${admin.id}:${dto.userId}:${Date.now()}`,
      description: dto.reason?.trim() || 'Admin deduction',
    });
    return this.walletService.getWalletSummary(dto.userId);
  }

  @Get('validate')
  validateWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.validateWalletBalance(user.id);
  }
}