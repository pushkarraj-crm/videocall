import { Module } from '@nestjs/common';
import { KycModule } from '../kyc/kyc.module';
import { UsersModule } from '../users/users.module';
import { HostsController } from './hosts.controller';
import { HostsService } from './hosts.service';

@Module({
  imports: [UsersModule, KycModule],
  controllers: [HostsController],
  providers: [HostsService],
  exports: [HostsService],
})
export class HostsModule {}