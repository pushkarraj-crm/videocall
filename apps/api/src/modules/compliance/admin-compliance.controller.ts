import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UpdateLegalPolicyDto } from './dto/update-legal-policy.dto';
import { LegalPolicyService } from './legal-policy.service';

@Roles(Role.admin, Role.super_admin, Role.grievance_officer)
@Controller('admin/compliance')
export class AdminComplianceController {
  constructor(private readonly legalPolicies: LegalPolicyService) {}

  @Get('policies')
  listPolicies() {
    return this.legalPolicies.listAdmin();
  }

  @Get('policies/:slug/history')
  getHistory(@Param('slug') slug: string) {
    return this.legalPolicies.getHistory(slug);
  }

  @Get('policies/:slug/history/:revisionId')
  getRevision(@Param('slug') slug: string, @Param('revisionId') revisionId: string) {
    return this.legalPolicies.getRevision(slug, revisionId);
  }

  @Patch('policies/:slug')
  updatePolicy(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() dto: UpdateLegalPolicyDto,
  ) {
    return this.legalPolicies.updatePolicy(slug, admin.id, dto);
  }
}