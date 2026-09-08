import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CommunicationsDispatcherService } from './communications-dispatcher.service';
import { InternalEmailDto } from './dto/internal-email.dto';
import { InternalSmsDto } from './dto/internal-sms.dto';
import { InternalApiKeyGuard } from './guards/internal-api-key.guard';

@Public()
@UseGuards(InternalApiKeyGuard)
@Controller('internal/communications')
export class InternalCommunicationsController {
  constructor(private readonly dispatcher: CommunicationsDispatcherService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('email')
  sendEmail(@Body() dto: InternalEmailDto) {
    return this.dispatcher.sendEmail(dto);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('sms')
  sendSms(@Body() dto: InternalSmsDto) {
    return this.dispatcher.sendSms(dto);
  }
}