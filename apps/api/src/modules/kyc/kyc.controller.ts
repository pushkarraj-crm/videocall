import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { InitiateKycDto } from './dto/initiate-kyc.dto';
import { KycService } from './kyc.service';

@Controller('hosts/kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('initiate')
  initiate(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitiateKycDto) {
    return this.kycService.initiate(user.id, dto.provider);
  }

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getStatus(user.id);
  }

  @Public()
  @Post('callback')
  callback(
    @Body()
    body: {
      providerReference: string;
      status: 'verified' | 'failed';
      pan?: string;
      aadhaarMasked?: string;
      fullName?: string;
      failureReason?: string;
    },
  ) {
    return this.kycService.handleCallback(body);
  }
}