import { Module } from '@nestjs/common';
import { AdminCallHistoryController } from './admin-call-history.controller';
import { CallHistoryController } from './call-history.controller';
import { CallHistoryService } from './call-history.service';
import { HostCallHistoryController } from './host-call-history.controller';

@Module({
  controllers: [CallHistoryController, HostCallHistoryController, AdminCallHistoryController],
  providers: [CallHistoryService],
  exports: [CallHistoryService],
})
export class CallHistoryModule {}