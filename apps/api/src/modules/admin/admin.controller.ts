import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { HostApplicationStatus, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminService } from './admin.service';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReviewHostApplicationDto } from './dto/review-host-application.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Roles(Role.admin, Role.super_admin, Role.moderator)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('users')
  searchUsers(
    @Query('q') query = '',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.searchUsers(
      query,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(admin.id, id, dto);
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

  @Get('reports')
  getReports(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getReports(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('reports/:id')
  resolveReport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminService.resolveReport(admin.id, id, dto.resolution, dto.action);
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
  @Patch('withdrawals/:id/approve')
  approveWithdrawal(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.adminService.approveWithdrawal(admin.id, id);
  }

  @Roles(Role.admin, Role.super_admin)
  @Post('earnings/release-held')
  releaseHeldEarnings() {
    return this.adminService.releaseHeldEarnings();
  }
}