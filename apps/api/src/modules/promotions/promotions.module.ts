import { Module } from '@nestjs/common';
import { RazorpayModule } from '../../integrations/razorpay/razorpay.module';
import { AdminPromotionsController } from './admin-promotions.controller';
import { PromotionsController } from './promotions.controller';
import { PromotionsAdminService } from './promotions-admin.service';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [RazorpayModule],
  controllers: [PromotionsController, AdminPromotionsController],
  providers: [PromotionsService, PromotionsAdminService],
  exports: [PromotionsService],
})
export class PromotionsModule {}