import { Module } from '@nestjs/common';
import { ZegoModule } from '../../integrations/zego/zego.module';
import { CallHistoryModule } from '../call-history/call-history.module';
import { GiftsModule } from '../gifts/gifts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { VirtualHostsModule } from '../virtual-hosts/virtual-hosts.module';
import { WalletModule } from '../wallet/wallet.module';
import { CallRoutingAdminController } from './routing/call-routing-admin.controller';

import { CallFallbackScheduler } from './routing/call-fallback.scheduler';
import { CallRoutingService } from './routing/call-routing.service';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [
    ZegoModule,
    WalletModule,
    UsersModule,
    CallHistoryModule,
    NotificationsModule,
    GiftsModule,
    VirtualHostsModule,
  ],
  controllers: [CallsController, CallRoutingAdminController],
  providers: [CallsService, CallRoutingService, CallFallbackScheduler],
  exports: [CallsService, CallRoutingService],
})
export class CallsModule {}