import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Get('packages')
  getPackages() {
    return this.paymentsService.getPackages();
  }

  @Public()
  @Get('razorpay/status')
  getRazorpayStatus() {
    return this.paymentsService.getRazorpayStatus();
  }

  @Throttle({ payments: { limit: 30, ttl: 60_000 } })
  @Post('create-order')
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.paymentsService.createOrder(user.id, dto.packageId, dto.customCoins);
  }

  @Throttle({ payments: { limit: 30, ttl: 60_000 } })
  @Post('confirm')
  confirmPayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirmPayment(
      user.id,
      dto.orderId,
      dto.paymentId,
      dto.signature,
    );
  }

  @Public()
  @Throttle({ payments: { limit: 60, ttl: 60_000 } })
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw request body required for webhook verification');
    }
    return this.paymentsService.handleWebhook(req.rawBody.toString(), signature);
  }

}