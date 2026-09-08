import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { HostApplicationStatus, Role, WithdrawalStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminService } from './admin.service';

import { AdminWithdrawalNoteDto } from './dto/admin-withdrawal-note.dto';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';
import { ReviewHostApplicationDto } from './dto/review-host-application.dto';

@Roles(Role.admin, Role.super_admin, Role.moderator)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Roles(Role.admin, Role.super_admin)
  @Get('revenue')
  getRevenue() {
    return this.adminService.getRevenue();
  }

  @Roles(Role.admin, Role.super_admin)
  @Post('revenue/withdraw')
  withdrawPlatformRevenue(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: { amountInr: number },
  ) {
    return this.adminService.withdrawPlatformRevenue(admin.id, body.amountInr);
  }

  @Roles(Role.admin, Role.super_admin)
  @Post('revenue/settle')
  markRevenueSettled(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: { amountInr: number; note?: string },
  ) {
    return this.adminService.markRevenueSettled(admin.id, body.amountInr, body.note);
  }

  @Get('hosts/applications')
  getHostApplications(@Query('status') status?: HostApplicationStatus) {
    return this.adminService.getHostApplications(status);
  }

  @Patch('hosts/applications/:id')
  reviewHostApplication(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewHostApplicationDto,
  ) {
    return this.adminService.reviewHostApplication(admin.id, id, dto);
  }

  @Get('audit-logs')
  getAuditLogs(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAuditLogs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('config')
  getConfig() {
    return this.adminService.getConfig();
  }

  @Patch('config/:key')
  updateConfig(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('key') key: string,
    @Body() body: { value: unknown },
  ) {
    return this.adminService.updateConfig(admin.id, key, body.value);
  }

  @Roles(Role.admin, Role.super_admin)
  @Get('withdrawals')
  getWithdrawals(
    @Query('status') status?: WithdrawalStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getWithdrawals(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Roles(Role.admin, Role.super_admin)
  @Patch('withdrawals/:id/approve')
  approveWithdrawal(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminWithdrawalNoteDto,
  ) {
    return this.adminService.approveWithdrawal(admin.id, id, dto.note);
  }

  @Roles(Role.admin, Role.super_admin)
  @Patch('withdrawals/:id/reject')
  rejectWithdrawal(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.adminService.rejectWithdrawal(admin.id, id, dto.reason);
  }

  @Roles(Role.admin, Role.super_admin)
  @Patch('withdrawals/:id/paid')
  markWithdrawalPaid(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { utr?: string; note?: string },
  ) {
    return this.adminService.markWithdrawalPaid(admin.id, id, body.utr, body.note);
  }

  @Roles(Role.admin, Role.super_admin)
  @Post('earnings/release-held')
  releaseHeldEarnings() {
    return this.adminService.releaseHeldEarnings();
  }
}