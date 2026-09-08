import { Controller, Delete, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { FollowsService } from './follows.service';

@Controller('hosts')
export class HostFollowController {
  constructor(private readonly follows: FollowsService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/follow')
  follow(@CurrentUser() user: AuthenticatedUser, @Param('id') hostId: string) {
    return this.follows.follow(user.id, hostId);
  }

  @Delete(':id/follow')
  unfollow(@CurrentUser() user: AuthenticatedUser, @Param('id') hostId: string) {
    return this.follows.unfollow(user.id, hostId);
  }
}