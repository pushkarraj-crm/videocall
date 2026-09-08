import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ResolutionAction, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminReportsQueryDto } from './dto/admin-reports-query.dto';
import { ReportAdminAction, UpdateReportDto } from './dto/update-report.dto';
import { ReportsAdminService } from './reports-admin.service';

function normalizeUpdateDto(
  body: UpdateReportDto & { action?: string; resolution?: string },
): UpdateReportDto {
  if (Object.values(ReportAdminAction).includes(body.action as ReportAdminAction)) {
    return body as UpdateReportDto;
  }

  const legacy = body.action as ResolutionAction | undefined;
  if (legacy === ResolutionAction.dismissed) {
    return {
      action: ReportAdminAction.reject,
      resolution: body.resolution,
      adminNote: body.adminNote,
      legacyAction: legacy,
    };
  }
  if (legacy === ResolutionAction.temp_suspend) {
    return {
      action: ReportAdminAction.suspend_user,
      resolution: body.resolution,
      adminNote: body.adminNote,
      legacyAction: legacy,
    };
  }
  if (legacy === ResolutionAction.permanent_ban) {
    return {
      action: ReportAdminAction.permanent_ban,
      resolution: body.resolution,
      adminNote: body.adminNote,
      legacyAction: legacy,
    };
  }

  return {
    action: ReportAdminAction.resolve,
    resolution: body.resolution ?? 'Resolved',
    adminNote: body.adminNote,
    legacyAction: legacy ?? ResolutionAction.warning,
  };
}

@Roles(Role.admin, Role.super_admin, Role.moderator)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reportsAdmin: ReportsAdminService) {}

  @Get()
  list(@Query() query: AdminReportsQueryDto) {
    return this.reportsAdmin.listReports(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.reportsAdmin.getReportById(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateReportDto & { action?: string; resolution?: string },
  ) {
    return this.reportsAdmin.updateReport(admin.id, id, normalizeUpdateDto(body));
  }
}