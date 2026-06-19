import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, WalletTransactionType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { RazorpayService } from '../../integrations/razorpay/razorpay.service';
import { ReferralsService } from '../referrals/referrals.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly wallet: WalletService,
    private readonly referrals: ReferralsService,
    private readonly config: ConfigService,
  ) {}

  async getPackages() {
    const packages = await this.prisma.coinPackage.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        priceInr: true,
        coinUnits: true,
        bonusUnits: true,
        sortOrder: true,
      },
    });

    return packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      priceInr: pkg.priceInr.toString(),
      coinUnits: pkg.coinUnits.toString(),
      bonusUnits: pkg.bonusUnits.toString(),
      totalCoins: Number(pkg.coinUnits + pkg.bonusUnits) / 100,
      bonusPercent:
        pkg.coinUnits > 0n
          ? Math.round((Number(pkg.bonusUnits) / Number(pkg.coinUnits)) * 100)
          : 0,
      sortOrder: pkg.sortOrder,
    }));
  }

  async createOrder(userId: string, packageId: string) {
    const pkg = await this.prisma.coinPackage.findFirst({
      where: { id: packageId, isActive: true, deletedAt: null },
    });

    if (!pkg) {
      throw new BusinessException('Package not found', 404, 'PACKAGE_NOT_FOUND');
    }

    const gstRate = this.config.get<number>('GST_RATE', 18);
    const gstInr = Number(pkg.priceInr) * (gstRate / 100);
    const totalInr = Number(pkg.priceInr) + gstInr;
    const idempotencyKey = `order:${userId}:${packageId}:${Date.now()}`;

    const order = await this.razorpay.createOrder({
      amountInr: totalInr,
      receipt: `rcpt_${uuidv4().replace(/-/g, '').slice(0, 20)}`,
      notes: { userId, packageId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        packageId,
        razorpayOrderId: order.id,
        amountInr: pkg.priceInr,
        gstInr,
        totalInr,
        coinUnitsCredited: pkg.coinUnits + pkg.bonusUnits,
        status: PaymentStatus.created,
        idempotencyKey,
      },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      amountInr: pkg.priceInr,
      gstInr,
      totalInr,
      currency: 'INR',
      keyId: this.config.get('RAZORPAY_KEY_ID'),
    };
  }

  async confirmPayment(
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string,
  ) {
    if (!this.razorpay.verifyPaymentSignature(orderId, paymentId, signature)) {
      throw new BusinessException('Invalid payment signature', 400, 'INVALID_SIGNATURE');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: orderId, userId },
    });

    if (!payment) {
      throw new BusinessException('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status === PaymentStatus.paid) {
      return payment;
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.paid,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        paidAt: new Date(),
        invoiceNumber: `INV-${Date.now()}`,
      },
    });

    await this.wallet.creditWallet({
      userId,
      amountUnits: updated.coinUnitsCredited,
      type: WalletTransactionType.recharge,
      referenceType: 'payment',
      referenceId: updated.id,
      idempotencyKey: `payment:credit:${updated.id}`,
      description: 'Coin recharge',
    });

    await this.referrals.qualifyReferral(userId, 'first_recharge');

    return updated;
  }

  async handleWebhook(rawBody: string, signature: string) {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new BusinessException('Invalid webhook signature', 400, 'INVALID_WEBHOOK');
    }

    const payload = JSON.parse(rawBody) as {
      event: string;
      payload: { payment: { entity: { id: string; order_id: string } } };
    };

    const eventId = (JSON.parse(rawBody) as { account_id?: string }).account_id
      ? `${payload.event}:${payload.payload?.payment?.entity?.id}`
      : uuidv4();

    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { razorpayEventId: eventId },
    });

    if (existing?.processed) {
      return { received: true };
    }

    const webhookEvent = await this.prisma.paymentWebhookEvent.upsert({
      where: { razorpayEventId: eventId },
      update: {},
      create: {
        razorpayEventId: eventId,
        eventType: payload.event,
        payload: JSON.parse(rawBody),
      },
    });

    if (payload.event === 'payment.captured') {
      const entity = payload.payload.payment.entity;
      const payment = await this.prisma.payment.findFirst({
        where: { razorpayOrderId: entity.order_id },
      });

      if (payment && payment.status !== PaymentStatus.paid) {
        await this.confirmPayment(
          payment.userId,
          entity.order_id,
          entity.id,
          signature,
        );
      }
    }

    await this.prisma.paymentWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true, processedAt: new Date() },
    });

    return { received: true };
  }

  async getInvoices(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId, status: PaymentStatus.paid },
      orderBy: { paidAt: 'desc' },
      select: {
        id: true,
        amountInr: true,
        gstInr: true,
        totalInr: true,
        coinUnitsCredited: true,
        invoiceNumber: true,
        paidAt: true,
      },
    });
  }
}