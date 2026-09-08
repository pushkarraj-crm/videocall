import { Module } from '@nestjs/common';
import { KycModule } from '../kyc/kyc.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { VirtualHostsModule } from '../virtual-hosts/virtual-hosts.module';
import { WalletModule } from '../wallet/wallet.module';
import { HostsController } from './hosts.controller';
import { HostsService } from './hosts.service';

@Module({
  imports: [UsersModule, WalletModule, NotificationsModule, KycModule, VirtualHostsModule],
  controllers: [HostsController],
  providers: [HostsService],
  exports: [HostsService],
})
export class HostsModule {}