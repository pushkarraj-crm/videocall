import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from '../admin/admin.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [ScheduleModule.forRoot(), ReferralsModule, AdminModule],
  providers: [TasksService],
})
export class TasksModule {}