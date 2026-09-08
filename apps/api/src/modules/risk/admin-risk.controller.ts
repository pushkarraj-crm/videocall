import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RiskAdminService } from './risk-admin.service';
import { RiskEventsQueryDto } from './dto/risk-events-query.dto';
import { RiskListQueryDto } from './dto/risk-list-query.dto';
import { UpdateRiskProfileDto } from './dto/update-risk-profile.dto';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/risk')
export class AdminRiskController {
  constructor(private readonly admin: RiskAdminService) {}

  @Get()
  dashboard() {
    return this.admin.getDashboard();
  }

  @Get('analytics')
  analytics() {
    return this.admin.getAnalytics();
  }

  @Get('events')
  events(@Query() query: RiskEventsQueryDto) {
    return this.admin.listEvents(query);
  }

  @Get('profiles')
  listProfiles(@Query() query: RiskListQueryDto) {
    return this.admin.listProfiles(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.admin.getProfileDetail(id);
  }

  @Patch(':id')
  update(
    @Param('id') userId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateRiskProfileDto,
  ) {
    return this.admin.updateProfile(userId, admin.id, dto);
  }
}