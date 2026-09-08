import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Role } from '@prisma/client';
import { KycCallbackDto } from './dto/kyc-callback.dto';
import { InitiateKycDto } from './dto/initiate-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycService } from './kyc.service';

@Controller('hosts/kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Roles(Role.host)
  @Post('submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitKycDto) {
    return this.kycService.submit(user.id, dto);
  }

  @Roles(Role.host)
  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getSummary(user.id);
  }

  @Roles(Role.host)
  @Get('history')
  getHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getHistory(user.id);
  }

  @Post('initiate')
  initiate(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitiateKycDto) {
    return this.kycService.initiate(user.id, dto.provider);
  }

  @Public()
  @UseGuards(InternalApiKeyGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('callback')
  callback(@Body() body: KycCallbackDto) {
    return this.kycService.handleCallback(body);
  }
}