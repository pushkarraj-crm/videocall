import { Module } from '@nestjs/common';
import { AdminNotificationsController } from './admin-notifications.controller';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationEventProcessorService } from './notification-event-processor.service';
import { NotificationEventsService } from './notification-events.service';
import { NotificationsAdminService } from './notifications-admin.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    NotificationsService,
    NotificationsAdminService,
    NotificationDispatcherService,
    NotificationEventsService,
    NotificationEventProcessorService,
  ],
  exports: [
    NotificationsService,
    NotificationsAdminService,
    NotificationDispatcherService,
    NotificationEventsService,
    NotificationEventProcessorService,
  ],
})
export class NotificationsModule {}