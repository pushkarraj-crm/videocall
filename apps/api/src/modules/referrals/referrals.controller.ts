import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  getMyReferrals(@CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.getMyReferrals(user.id);
  }

  @Post('apply')
  applyReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyReferralDto,
  ) {
    return this.referralsService.applyReferralCode(user.id, dto.referralCode);
  }
}