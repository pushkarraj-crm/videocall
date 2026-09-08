import { Module, forwardRef } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { AdminReferralsController } from './admin-referrals.controller';
import { HostReferralController } from './host-referral.controller';
import { ReferralController } from './referral.controller';
import { ReferralsAdminService } from './referrals-admin.service';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [forwardRef(() => WalletModule)],
  controllers: [
    ReferralsController,
    ReferralController,
    AdminReferralsController,
    HostReferralController,
  ],
  providers: [ReferralsService, ReferralsAdminService],
  exports: [ReferralsService, ReferralsAdminService],
})
export class ReferralsModule {}