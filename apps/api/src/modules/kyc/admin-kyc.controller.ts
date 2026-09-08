import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { KycVerificationStatus, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { KycService } from './kyc.service';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/kyc')
export class AdminKycController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  list(@Query('status') status?: KycVerificationStatus) {
    return this.kycService.listForAdmin(status);
  }

  @Patch(':id/approve')
  approve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.kycService.approve(admin.id, id);
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectKycDto,
  ) {
    return this.kycService.reject(admin.id, id, dto.note);
  }

  @Get(':id/document/:type')
  @Header('Content-Type', 'application/octet-stream')
  async document(
    @Param('id') id: string,
    @Param('type') type: 'selfie' | 'aadhaar_front' | 'aadhaar_back',
  ) {
    const buffer = await this.kycService.getDocument(id, type);
    return new StreamableFile(buffer);
  }
}