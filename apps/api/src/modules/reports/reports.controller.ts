import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('reports')
  createReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.createReport(user.id, dto);
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