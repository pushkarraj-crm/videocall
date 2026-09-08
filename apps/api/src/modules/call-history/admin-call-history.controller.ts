import { Controller, Get, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CallHistoryService } from './call-history.service';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/calls')
export class AdminCallHistoryController {
  constructor(private readonly callHistoryService: CallHistoryService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.callHistoryService.listForAdmin({
      q,
      status,
      type,
      from,
      to,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.callHistoryService.getByIdForAdmin(id);
  }
}