import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AddBankAccountDto } from './dto/add-bank-account.dto';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SetHostStatusDto } from './dto/set-host-status.dto';
import { HostsService } from './hosts.service';

@Controller('hosts')
export class HostsController {
  constructor(private readonly hostsService: HostsService) {}

  @Get('discover')
  browseHosts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hostsService.browseHosts(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      user.id,
    );
  }

  @Post('apply')
  apply(@CurrentUser() user: AuthenticatedUser) {
    return this.hostsService.applyForHost(user.id);
  }

  @Get('application')
  application(@CurrentUser() user: AuthenticatedUser) {
    return this.hostsService.getApplicationStatus(user.id);
  }

  @Roles(Role.host)
  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.hostsService.getHostStatus(user.id);
  }

  @Roles(Role.host)
  @Patch('status')
  setStatus(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetHostStatusDto) {
    return this.hostsService.setHostStatus(user.id, dto.status);
  }

  @Roles(Role.host)
  @Post('heartbeat')
  heartbeat(@CurrentUser() user: AuthenticatedUser) {
    return this.hostsService.recordHeartbeat(user.id);
  }

  @Roles(Role.host)
  @Patch('availability')
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.hostsService.setAvailability(user.id, dto.isAvailable);
  }

  @Roles(Role.host)
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.hostsService.getDashboard(user.id);
  }

  @Roles(Role.host)
  @Post('bank-accounts')
  addBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddBankAccountDto,
  ) {
    return this.hostsService.addBankAccount(user.id, dto);
  }

  @Roles(Role.host)
  @Get('earnings/history')
  earningsHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hostsService.listEarningsHistory(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles(Role.host)
  @Get('earnings')
  earnings(@CurrentUser() user: AuthenticatedUser) {
    return this.hostsService.getEarningsSummary(user.id);
  }

  @Roles(Role.host)
  @Get('withdrawals')
  listWithdrawals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.hostsService.listWithdrawals(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles(Role.host)
  @Get('bank-accounts')
  listBankAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.hostsService.listBankAccounts(user.id);
  }

  @Roles(Role.host)
  @Post('withdrawals')
  requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.hostsService.requestWithdrawal(user.id, dto);
  }
}