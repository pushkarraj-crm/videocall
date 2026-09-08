import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { ReportsModule } from '../reports/reports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { WalletModule } from '../wallet/wallet.module';
import { VirtualHostsModule } from '../virtual-hosts/virtual-hosts.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminPackagesController, AdminWalletController } from './admin-wallet.controller';
import { AdminWalletService } from './admin-wallet.service';

@Module({
  imports: [UsersModule, ModerationModule, NotificationsModule, ReportsModule, WalletModule, VirtualHostsModule],
  controllers: [
    AdminController,
    AdminAnalyticsController,
    AdminOperationsController,
    AdminUsersController,
    AdminWalletController,
    AdminPackagesController,
  ],
  providers: [
    AdminService,
    AdminAnalyticsService,
    AdminOperationsService,
    AdminUsersService,
    AdminWalletService,
  ],
  exports: [
    AdminService,
    AdminAnalyticsService,
    AdminOperationsService,
    AdminUsersService,
    AdminWalletService,
  ],
})
export class AdminModule {}