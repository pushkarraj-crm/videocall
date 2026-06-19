import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ComplianceService } from './compliance.service';
import { CreateGrievanceDto } from './dto/create-grievance.dto';

@Controller('grievance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateGrievanceDto) {
    return this.complianceService.createGrievance(dto);
  }

  @Roles(Role.grievance_officer, Role.admin, Role.super_admin)
  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.complianceService.listGrievances(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles(Role.grievance_officer, Role.admin, Role.super_admin)
  @Patch(':id/acknowledge')
  acknowledge(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.complianceService.acknowledgeGrievance(id, body.notes);
  }

  @Roles(Role.grievance_officer, Role.admin, Role.super_admin)
  @Patch(':id/resolve')
  resolve(@Param('id') id: string, @Body() body: { notes: string }) {
    return this.complianceService.resolveGrievance(id, body.notes);
  }
}