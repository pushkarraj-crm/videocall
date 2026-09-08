import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminFollowersQueryDto } from './dto/admin-followers-query.dto';
import { FollowsAdminService } from './follows-admin.service';

@Roles(Role.admin, Role.super_admin, Role.moderator)
@Controller('admin/followers')
export class AdminFollowersController {
  constructor(private readonly followsAdmin: FollowsAdminService) {}

  @Get('stats')
  stats() {
    return this.followsAdmin.getStats();
  }

  @Get()
  list(@Query() query: AdminFollowersQueryDto) {
    return this.followsAdmin.listFollows(query);
  }

  @Delete(':id')
  removeFakeFollow(@Param('id') id: string) {
    return this.followsAdmin.removeFakeFollow(id);
  }
}