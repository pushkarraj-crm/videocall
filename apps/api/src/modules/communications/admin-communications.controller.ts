import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommunicationsAdminService } from './communications-admin.service';
import { CommunicationsLogsQueryDto } from './dto/communications-logs-query.dto';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/communications')
export class AdminCommunicationsController {
  constructor(private readonly admin: CommunicationsAdminService) {}

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.list(page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('analytics')
  analytics() {
    return this.admin.getAnalytics();
  }

  @Get('logs')
  logs(@Query() query: CommunicationsLogsQueryDto) {
    return this.admin.getLogs(query.page, query.limit, query.channel, query.status);
  }
}