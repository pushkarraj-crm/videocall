import { Body, Controller, Get, Param, Patch, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminOperationsService } from './admin-operations.service';
import {
  OperationsLogsQueryDto,
  OperationsOverviewQueryDto,
  OperationsPaymentsQueryDto,
  OperationsReportExportDto,
  OperationsSupportQueryDto,
} from './dto/operations-query.dto';

@Roles(Role.admin, Role.super_admin, Role.support)
@Controller('admin/operations')
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get('overview')
  getOverview(@Query() query: OperationsOverviewQueryDto) {
    return this.operations.getOverview(query.period, query.from, query.to);
  }

  @Get('live-calls')
  getLiveCalls(@Query('limit') limit?: string) {
    return this.operations.getLiveCalls(limit ? parseInt(limit, 10) : 20);
  }

  @Get('hosts')
  getHosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.operations.getHostsSnapshot(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('payments')
  getPayments(@Query() query: OperationsPaymentsQueryDto) {
    return this.operations.getPayments(
      query.page ?? 1,
      query.limit ?? 20,
      query.status,
    );
  }

  @Get('support')
  getSupport(@Query() query: OperationsSupportQueryDto) {
    return this.operations.getSupportTickets(
      query.page ?? 1,
      query.limit ?? 20,
      query.status,
    );
  }

  @Patch('support/:id')
  replySupport(
    @Param('id') id: string,
    @Body() body: { notes: string; action: 'acknowledge' | 'resolve' },
  ) {
    return this.operations.replySupportTicket(id, body.notes, body.action);
  }

  @Get('logs')
  getLogs(@Query() query: OperationsLogsQueryDto) {
    return this.operations.getLogs(query.type ?? 'all', query.page ?? 1, query.limit ?? 50);
  }

  @Get('settings')
  getSettings() {
    return this.operations.getSettings();
  }

  @Get('reports/export')
  async exportReport(@Query() query: OperationsReportExportDto, @Res() res: Response) {
    const content = await this.operations.exportReport(
      query.report,
      query.period,
      query.from,
      query.to,
      query.format ?? 'csv',
    );
    const ext = query.format === 'excel' ? 'csv' : 'csv';
    const mime =
      query.format === 'excel'
        ? 'text/csv; charset=utf-8'
        : 'text/csv; charset=utf-8';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="operations-${query.report}-${query.period ?? '30d'}.${ext}"`,
    );
    res.send(content);
  }
}