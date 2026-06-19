import { Body, Controller, Get, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
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

  @Throttle({ payments: { limit: 30, ttl: 60_000 } })
  @Post('create-order')
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.paymentsService.createOrder(user.id, dto.packageId);
  }

  @Post('confirm')
  confirmPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { orderId: string; paymentId: string; signature: string },
  ) {
    return this.paymentsService.confirmPayment(
      user.id,
      body.orderId,
      body.paymentId,
      body.signature,
    );
  }

  @Public()
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);
    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Get('invoices')
  getInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getInvoices(user.id);
  }
}