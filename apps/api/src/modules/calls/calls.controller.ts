import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CallEndReason } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CallConsentDto } from './dto/call-consent.dto';
import { InitiateCallDto } from './dto/initiate-call.dto';
import { SendGiftExtendedDto } from '../gifts/dto/send-gift-extended.dto';
import { CallRoutingService } from './routing/call-routing.service';
import { MatchCallDto } from './routing/dto/match-call.dto';
import { CallsService } from './calls.service';

@Throttle({
  default: {
    limit: process.env.NODE_ENV === 'production' ? 60_000 : 600,
    ttl: 60_000,
  },
})
@Controller('calls')
export class CallsController {
  constructor(
    private readonly callsService: CallsService,
    private readonly callRouting: CallRoutingService,
  ) {}

  @Post('match')
  match(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MatchCallDto,
    @Ip() ip: string,
  ) {
    return this.callRouting.matchCall(user.id, ip, {
      preferredLanguage: dto.preferredLanguage,
      preferredRegion: dto.preferredRegion,
    });
  }

  @Post('initiate')
  initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateCallDto,
    @Ip() ip: string,
  ) {
    return this.callsService.initiateCall(user.id, dto.calleeId, ip);
  }

  @Post(':id/consent')
  recordConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CallConsentDto,
    @Ip() ip: string,
  ) {
    return this.callsService.recordConsent(id, user.id, dto.documentVersion, ip);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.callsService.acceptCall(id, user.id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.callsService.rejectCall(id, user.id);
  }

  @Post(':id/end')
  end(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.callsService.endCall(id, CallEndReason.user_ended, user.id);
  }

  @Post(':id/billing-tick')
  billingTick(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.callsService.processBillingTick(id, user.id);
  }

  @Post(':id/gifts')
  sendGift(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendGiftExtendedDto,
  ) {
    return this.callsService.sendGift(
      id,
      user.id,
      dto.giftId,
      dto.quantity ?? 1,
      dto.idempotencyKey,
    );
  }

  @Get('incoming')
  incoming(@CurrentUser() user: AuthenticatedUser) {
    return this.callsService.getIncomingCalls(user.id);
  }

  @Get()
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.callsService.getCallHistory(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  getCall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.callsService.getCallById(id, user.id);
  }
}
