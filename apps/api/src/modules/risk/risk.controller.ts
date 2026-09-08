import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RegisterFingerprintDto } from './dto/register-fingerprint.dto';
import { RiskFingerprintService } from './risk-fingerprint.service';

@Controller('risk')
export class RiskController {
  constructor(private readonly fingerprints: RiskFingerprintService) {}

  @Post('fingerprint')
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterFingerprintDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress;
    return this.fingerprints.register(user.id, dto, ip);
  }
}