import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { FavoritesQueryDto } from './dto/favorites-query.dto';
import { FollowsService } from './follows.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly follows: FollowsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: FavoritesQueryDto) {
    return this.follows.getFavorites(user.id, query);
  }
}