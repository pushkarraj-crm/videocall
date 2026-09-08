import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ReferralsService } from './referrals.service';

@Roles(Role.host)
@Controller('host/referral')
export class HostReferralController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getHostReferralStats(user.id);
  }
}