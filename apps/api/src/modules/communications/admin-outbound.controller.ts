import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CommunicationsAdminService } from './communications-admin.service';
import { AdminEmailDto } from './dto/admin-email.dto';
import { AdminSmsDto } from './dto/admin-sms.dto';

@Roles(Role.admin, Role.super_admin)
@Controller('admin')
export class AdminOutboundController {
  constructor(private readonly admin: CommunicationsAdminService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('email')
  sendEmail(@CurrentUser() admin: AuthenticatedUser, @Body() dto: AdminEmailDto) {
    return this.admin.composeEmail(admin.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sms')
  sendSms(@CurrentUser() admin: AuthenticatedUser, @Body() dto: AdminSmsDto) {
    return this.admin.composeSms(admin.id, dto);
  }
}