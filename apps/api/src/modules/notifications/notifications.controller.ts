import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices')
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.notificationsService.registerDevice(user.id, dto);
  }

  @Delete('devices')
  unregister(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { token: string },
  ) {
    return this.notificationsService.unregisterDevice(user.id, body.token);
  }

  @Get('devices')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getActiveTokens(user.id);
  }
}