import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { FollowsService } from './follows.service';

@Roles(Role.host)
@Controller('host')
export class HostFollowersController {
  constructor(private readonly follows: FollowsService) {}

  @Get('followers')
  getFollowers(@CurrentUser() user: AuthenticatedUser) {
    return this.follows.getHostFollowersSummary(user.id);
  }
}