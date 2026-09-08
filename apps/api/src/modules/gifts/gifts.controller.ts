import { Controller, Get, Param, Query } from '@nestjs/common';
import { GiftCategory } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { GiftsService } from './gifts.service';

@Controller('gifts')
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Public()
  @Get('catalog')
  catalog(
    @Query('category') category?: GiftCategory,
    @Query('featured') featured?: string,
    @Query('trending') trending?: string,
  ) {
    return this.giftsService.getCatalog({
      category,
      featured: featured === 'true',
      trending: trending === 'true',
    });
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.giftsService.getUserGiftHistory(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('stats/me')
  myStats(@CurrentUser() user: AuthenticatedUser) {
    return this.giftsService.getUserGiftStats(user.id);
  }

  @Get('stats/host')
  hostStats(@CurrentUser() user: AuthenticatedUser) {
    return this.giftsService.getHostGiftStats(user.id);
  }

  @Public()
  @Get('leaderboard')
  leaderboard(@Query('period') period?: 'daily' | 'weekly' | 'monthly' | 'all_time') {
    return this.giftsService.getLeaderboard(period ?? 'weekly');
  }

  @Get('calls/:callId/feed')
  callFeed(@Param('callId') callId: string, @Query('since') since?: string) {
    return this.giftsService.getCallGiftFeed(callId, since);
  }
}