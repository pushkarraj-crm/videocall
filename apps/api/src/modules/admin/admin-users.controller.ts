import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminUsersService } from './admin-users.service';
import {
  AdminUserHostControlsDto,
  AdminUserNoteDto,
  AdminUsersQueryDto,
  AdminUserSuspendDto,
} from './dto/admin-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.ip;
}

@Roles(Role.admin, Role.super_admin)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id/history')
  getHistory(
    @Param('id') id: string,
    @Query('type') type: 'recharges' | 'calls' | 'withdrawals' | 'admin_logs' = 'recharges',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminUsersService.getUserHistory(
      id,
      type,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.adminUsersService.getUserDetail(id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    return this.adminUsersService.updateStatus(admin.id, id, dto, clientIp(req));
  }

  @Patch(':id/suspend')
  suspend(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUserSuspendDto,
    @Req() req: Request,
  ) {
    return this.adminUsersService.suspendUser(admin.id, id, dto.note, clientIp(req));
  }

  @Patch(':id/unsuspend')
  unsuspend(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminUsersService.unsuspendUser(admin.id, id, clientIp(req));
  }

  @Patch(':id/block')
  block(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUserSuspendDto,
    @Req() req: Request,
  ) {
    return this.adminUsersService.blockUser(admin.id, id, dto.note, clientIp(req));
  }

  @Patch(':id/unblock')
  unblock(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminUsersService.unblockUser(admin.id, id, clientIp(req));
  }

  @Patch(':id/force-offline')
  forceOffline(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminUsersService.forceOffline(admin.id, id, clientIp(req));
  }

  @Post(':id/force-logout')
  forceLogout(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminUsersService.forceLogout(admin.id, id, clientIp(req));
  }

  @Patch(':id/note')
  updateNote(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUserNoteDto,
    @Req() req: Request,
  ) {
    return this.adminUsersService.updateAdminNote(admin.id, id, dto.note, clientIp(req));
  }

  @Patch(':id/host-controls')
  hostControls(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUserHostControlsDto,
    @Req() req: Request,
  ) {
    return this.adminUsersService.updateHostControls(admin.id, id, dto, clientIp(req));
  }

  @Post(':id/reset-free-calls')
  resetFreeCalls(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminUsersService.resetFreeCalls(admin.id, id, clientIp(req));
  }

  @Post(':id/approve-host')
  approveHost(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminUsersService.approveHost(admin.id, id, clientIp(req));
  }

  @Post(':id/reject-host')
  rejectHost(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUserSuspendDto,
    @Req() req: Request,
  ) {
    return this.adminUsersService.rejectHost(admin.id, id, dto.note, clientIp(req));
  }

  @Delete(':id')
  deleteUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminUsersService.deleteUser(admin.id, id, clientIp(req));
  }
}