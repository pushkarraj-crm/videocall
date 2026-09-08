import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, WalletTransactionType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { coinsToUnits } from '../../common/constants/coins';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { RazorpayService } from '../../integrations/razorpay/razorpay.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
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
    private readonly notifications: NotificationDispatcherService,
  ) {}

  async getPackages() {
    const packages = await this.prisma.coinPackage.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        priceInr: true,
        mrpInr: true,
        coinUnits: true,
        bonusUnits: true,
        isBestValue: true,
        isMostPopular: true,
        isLimitedOffer: true,
        sortOrder: true,
      },
    });

    return packages.map((pkg) => {
      const baseCoins = Number(pkg.coinUnits) / 100;
      const bonusCoins = Number(pkg.bonusUnits) / 100;
      const totalCoins = baseCoins + bonusCoins;
      const price = Number(pkg.priceInr);
      const mrp = pkg.mrpInr ? Number(pkg.mrpInr) : price;

      return {
        id: pkg.id,
        name: pkg.name,
        priceInr: pkg.priceInr.toString(),
        mrpInr: mrp.toString(),
        coinUnits: pkg.coinUnits.toString(),
        bonusUnits: pkg.bonusUnits.toString(),
        baseCoins,
        bonusCoins,
        totalCoins,
        discountPercent: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
        isBestValue: pkg.isBestValue,
        isMostPopular: pkg.isMostPopular,
        isLimitedOffer: pkg.isLimitedOffer,
        sortOrder: pkg.sortOrder,
      };
    });
  }

  async createOrder(userId: string, packageId?: string, customCoins?: number) {
    if (!packageId && !customCoins) {
      throw new BusinessException('Package or custom amount required', 400, 'INVALID_ORDER');
    }

    if (packageId && customCoins) {
      throw new BusinessException('Specify package or custom amount, not both', 400, 'INVALID_ORDER');
    }

    let priceInr: number;
    let coinUnitsCredited: bigint;
    let resolvedPackageId: string | null = packageId ?? null;

    if (packageId) {
      const pkg = await this.prisma.coinPackage.findFirst({
        where: { id: packageId, isActive: true, deletedAt: null },
      });

      if (!pkg) {
        throw new BusinessException('Package not found', 404, 'PACKAGE_NOT_FOUND');
      }

      priceInr = Number(pkg.priceInr);
      coinUnitsCredited = pkg.coinUnits + pkg.bonusUnits;
    } else {
      priceInr = customCoins!;
      coinUnitsCredited = coinsToUnits(customCoins!);
      resolvedPackageId = null;
    }

    const gstInr = 0;
    const totalInr = priceInr;
    const idempotencyKey = `order:${userId}:${resolvedPackageId ?? `custom:${customCoins}`}:${Date.now()}`;

    const order = await this.razorpay.createOrder({
      amountInr: totalInr,
      receipt: `rcpt_${uuidv4().replace(/-/g, '').slice(0, 20)}`,
      notes: {
        userId,
        packageId: resolvedPackageId ?? 'custom',
        customCoins: customCoins?.toString() ?? '',
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        packageId: resolvedPackageId,
        razorpayOrderId: order.id,
        amountInr: priceInr,
        gstInr,
        totalInr,
        coinUnitsCredited,
        status: PaymentStatus.created,
        idempotencyKey,
        metadata: customCoins ? { customCoins } : undefined,
      },
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      amountInr: priceInr,
      gstInr,
      totalInr,
      currency: 'INR',
      keyId: this.config.get('RAZORPAY_KEY_ID'),
      coinUnitsCredited: coinUnitsCredited.toString(),
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

    const payment = await this.fulfillPayment(orderId, paymentId, signature, userId);
    const wallet = await this.wallet.getWalletSummary(userId);

    return {
      payment: {
        id: payment.id,
        status: payment.status,
        coinUnitsCredited: payment.coinUnitsCredited.toString(),
        paidAt: payment.paidAt,
      },
      wallet,
    };
  }

  private async fulfillPayment(
    orderId: string,
    razorpayPaymentId: string,
    signature: string | null,
    userId?: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        razorpayOrderId: orderId,
        ...(userId ? { userId } : {}),
      },
    });

    if (!payment) {
      throw new BusinessException('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status === PaymentStatus.paid) {
      return payment;
    }

    const duplicatePayment = await this.prisma.payment.findFirst({
      where: {
        razorpayPaymentId,
        NOT: { id: payment.id },
        status: PaymentStatus.paid,
      },
    });

    if (duplicatePayment) {
      throw new BusinessException(
        'Payment already processed',
        409,
        'DUPLICATE_PAYMENT',
      );
    }

    await this.wallet.ensureWallet(payment.userId);
    await this.wallet.creditWallet({
      userId: payment.userId,
      amountUnits: payment.coinUnitsCredited,
      type: WalletTransactionType.payment_credit,
      referenceType: 'payment',
      referenceId: payment.id,
      idempotencyKey: `payment:credit:${payment.id}`,
      description: `Recharge ₹${payment.amountInr}`,
    });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id, status: PaymentStatus.created },
      data: {
        status: PaymentStatus.paid,
        razorpayPaymentId,
        razorpaySignature: signature,
        paidAt: new Date(),
        invoiceNumber: `INV-${Date.now()}`,
      },
    });

    await this.referrals.qualifyReferral(payment.userId, 'first_recharge');

    const coins = Number(updated.coinUnitsCredited) / 100;
    this.notifications.dispatchSafe(
      this.notifications.onRechargeSuccess(
        updated.id,
        updated.userId,
        String(updated.amountInr),
        coins,
      ),
      `recharge_success/${updated.id}`,
    );

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
        await this.fulfillPayment(entity.order_id, entity.id, null);
      }
    }

    if (payload.event === 'payment.failed') {
      const entity = payload.payload.payment.entity;
      const payment = await this.prisma.payment.findFirst({
        where: { razorpayOrderId: entity.order_id },
      });

      if (payment && payment.status !== PaymentStatus.paid) {
        this.notifications.dispatchSafe(
          this.notifications.onRechargeFailed(
            payment.id,
            payment.userId,
            String(payment.amountInr),
            'Payment was declined or timed out',
          ),
          `recharge_failed/${payment.id}`,
        );
      }
    }

    await this.prisma.paymentWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true, processedAt: new Date() },
    });

    return { received: true };
  }

  getRazorpayStatus() {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');

    return {
      configured: Boolean(keyId && keySecret),
      keyIdPresent: Boolean(keyId),
      keySecretPresent: Boolean(keySecret),
      webhookSecretPresent: Boolean(webhookSecret),
      keyIdPrefix: keyId ? `${keyId.slice(0, 8)}…` : null,
      checkoutReady: Boolean(keyId && keySecret),
      webhookReady: Boolean(webhookSecret),
    };
  }

}