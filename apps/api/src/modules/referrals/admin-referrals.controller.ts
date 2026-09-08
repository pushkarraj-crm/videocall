import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { ReferralProgramConfig } from '../../common/utils/referral-config';
import { CancelReferralDto } from './dto/admin-referral-action.dto';
import { AdminReferralsQueryDto } from './dto/admin-referrals-query.dto';
import { ReferralsAdminService } from './referrals-admin.service';
import { ReferralsService } from './referrals.service';

@Roles(Role.admin, Role.super_admin, Role.moderator)
@Controller('admin/referrals')
export class AdminReferralsController {
  constructor(
    private readonly referralsAdmin: ReferralsAdminService,
    private readonly referrals: ReferralsService,
  ) {}

  @Get()
  list(@Query() query: AdminReferralsQueryDto) {
    return this.referralsAdmin.listReferrals(query);
  }

  @Get('export')
  async export(@Query() query: AdminReferralsQueryDto, @Res() res: Response) {
    const { csv, count } = await this.referralsAdmin.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="referrals-${count}.csv"`);
    res.send(csv);
  }

  @Get('settings')
  getSettings() {
    return this.referralsAdmin.getSettings();
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: ReferralProgramConfig,
  ) {
    return this.referralsAdmin.updateSettings(body, admin.id);
  }

  @Post('reward')
  manualReward(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: { referralId: string },
  ) {
    return this.referrals.manualReward(body.referralId, admin.id);
  }

  @Post('cancel')
  cancelReferral(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: CancelReferralDto & { referralId: string },
  ) {
    return this.referrals.cancelReferral(body.referralId, admin.id, body.reason);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.referrals.getReferralById(id);
  }
}