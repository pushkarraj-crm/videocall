import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Throttle({ default: { limit: 5, ttl: 86_400_000 } })
  @Post('reports')
  createReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.createReport(user.id, dto);
  }

  @Get('reports/me')
  listMyReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.listMyReports(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('blocks')
  blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBlockDto,
  ) {
    return this.reportsService.blockUser(user.id, dto);
  }

  @Delete('blocks/:userId')
  unblockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') blockedId: string,
  ) {
    return this.reportsService.unblockUser(user.id, blockedId);
  }

  @Get('blocks')
  listBlocks(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.listBlocks(user.id);
  }
}