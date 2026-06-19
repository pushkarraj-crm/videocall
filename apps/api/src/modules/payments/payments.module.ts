import { Module } from '@nestjs/common';
import { RazorpayModule } from '../../integrations/razorpay/razorpay.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [RazorpayModule, WalletModule, ReferralsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}