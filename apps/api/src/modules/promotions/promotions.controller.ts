import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApplyPromoDto } from './dto/apply-promo.dto';
import { CheckoutPromoDto } from './dto/checkout-promo.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get('available')
  getAvailable(
    @CurrentUser() user: AuthenticatedUser,
    @Query('packageId') packageId?: string,
    @Query('customCoins') customCoins?: string,
  ) {
    return this.promotions.getAvailable(
      user.id,
      packageId,
      customCoins ? Number(customCoins) : undefined,
    );
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('apply')
  async apply(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplyPromoDto) {
    try {
      return await this.promotions.applyPromo(
        user.id,
        dto.code,
        dto.packageId,
        dto.customCoins,
      );
    } catch (err) {
      if (err instanceof Error && 'code' in err) {
        await this.promotions.logInvalidAttempt(
          user.id,
          dto.code,
          (err as Error & { code?: string }).code ?? 'UNKNOWN',
        );
      }
      throw err;
    }
  }

  @Post('remove')
  remove(@CurrentUser() user: AuthenticatedUser) {
    return this.promotions.removePromo(user.id);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.promotions.getHistory(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutPromoDto) {
    return this.promotions.checkout(user.id, dto.packageId, dto.customCoins);
  }
}
