import { Controller, Get, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AnalyticsExportQueryDto, AnalyticsQueryDto } from './dto/analytics-query.dto';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('dashboard')
  getDashboard(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDashboard(query.period, query.from, query.to);
  }

  @Get('export')
  async exportCsv(@Query() query: AnalyticsExportQueryDto, @Res() res: Response) {
    const csv = await this.analyticsService.exportCsv(
      query.type,
      query.period,
      query.from,
      query.to,
    );
    const filename = `analytics-${query.type}-${query.period ?? '30d'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}