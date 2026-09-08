import { Module } from '@nestjs/common';
import { AdminComplianceController } from './admin-compliance.controller';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { LegalController } from './legal.controller';
import { LegalPolicyService } from './legal-policy.service';

@Module({
  controllers: [ComplianceController, LegalController, AdminComplianceController],
  providers: [ComplianceService, LegalPolicyService],
  exports: [LegalPolicyService],
})
export class ComplianceModule {}