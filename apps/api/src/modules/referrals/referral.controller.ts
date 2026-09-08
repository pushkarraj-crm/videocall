import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { ReferralHistoryQueryDto } from './dto/referral-history-query.dto';
import { ReferralsService } from './referrals.service';

@Controller('referral')
export class ReferralController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('apply')
  applyReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyReferralDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress;
    return this.referralsService.applyReferralCode(user.id, dto.referralCode, {
      ip,
      deviceFingerprint: dto.deviceFingerprint,
    });
  }

  @Get('me')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.getReferralDashboard(user.id);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReferralHistoryQueryDto,
  ) {
    return this.referralsService.getReferralHistory(
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }
}