import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminWalletService } from './admin-wallet.service';
import { CreateCoinPackageDto, UpdateCoinPackageDto } from './dto/coin-package.dto';
import { WalletAdjustDto } from './dto/wallet-adjust.dto';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/wallet')
export class AdminWalletController {
  constructor(private readonly adminWallet: AdminWalletService) {}

  @Get('overview')
  overview() {
    return this.adminWallet.getOverview();
  }

  @Get('transactions')
  transactions(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminWallet.listTransactions(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('users/:userId/adjust')
  adjust(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: WalletAdjustDto,
  ) {
    return this.adminWallet.adjustWallet(admin.id, userId, dto);
  }
}

@Roles(Role.admin, Role.super_admin)
@Controller('admin/packages')
export class AdminPackagesController {
  constructor(private readonly adminWallet: AdminWalletService) {}

  @Get()
  list() {
    return this.adminWallet.listPackages();
  }

  @Post()
  create(@Body() dto: CreateCoinPackageDto) {
    return this.adminWallet.createPackage(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCoinPackageDto) {
    return this.adminWallet.updatePackage(id, dto);
  }
}