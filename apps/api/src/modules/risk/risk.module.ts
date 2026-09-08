import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminRiskController } from './admin-risk.controller';
import { InternalRiskController } from './internal-risk.controller';
import { RiskActionsService } from './risk-actions.service';
import { RiskAdminService } from './risk-admin.service';
import { RiskEngineService } from './risk-engine.service';
import { RiskEnforcementGuard } from './risk-enforcement.guard';
import { RiskEventProcessorService } from './risk-event-processor.service';
import { RiskFingerprintService } from './risk-fingerprint.service';
import { RiskQueueService } from './risk-queue.service';
import { RiskRulesService } from './risk-rules.service';
import { RiskController } from './risk.controller';

@Module({
  controllers: [RiskController, AdminRiskController, InternalRiskController],
  providers: [
    RiskRulesService,
    RiskEngineService,
    RiskActionsService,
    RiskAdminService,
    RiskEventProcessorService,
    RiskQueueService,
    RiskFingerprintService,
    { provide: APP_GUARD, useClass: RiskEnforcementGuard },
  ],
  exports: [
    RiskEngineService,
    RiskActionsService,
    RiskAdminService,
    RiskEventProcessorService,
    RiskQueueService,
    RiskFingerprintService,
  ],
})
export class RiskModule {}