import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { UsersModule } from '../users/users.module';
import { AdminReportsController } from './admin-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsAdminService } from './reports-admin.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [ModerationModule, UsersModule],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService, ReportsAdminService],
  exports: [ReportsService, ReportsAdminService],
})
export class ReportsModule {}