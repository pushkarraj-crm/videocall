import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { HostsModule } from '../hosts/hosts.module';
import { CommunicationsModule } from '../communications/communications.module';
import { RiskModule } from '../risk/risk.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    ReferralsModule,
    PromotionsModule,
    NotificationsModule,
    CommunicationsModule,
    RiskModule,
    AdminModule,
    HostsModule,
  ],
  providers: [TasksService],
})
export class TasksModule {}