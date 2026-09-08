import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { SendAnnouncementDto } from './dto/send-announcement.dto';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationsAdminService } from './notifications-admin.service';

@Roles(Role.admin, Role.super_admin)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly admin: NotificationsAdminService,
  ) {}

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.list(page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('analytics')
  analytics() {
    return this.admin.getAnalytics();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateBroadcastDto) {
    return this.admin.createBroadcast(admin.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('announce')
  announce(@CurrentUser() admin: AuthenticatedUser, @Body() dto: SendAnnouncementDto) {
    return this.dispatcher.broadcastAnnouncement(admin.id, dto);
  }
}