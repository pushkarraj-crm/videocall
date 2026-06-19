import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import { BusinessException } from '../../common/exceptions/business.exception';

export interface CreateOrderInput {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}

@Injectable()
export class RazorpayService {
  private client: Razorpay | null = null;

  constructor(private readonly config: ConfigService) {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');

    if (keyId && keySecret) {
      this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
  }

  private ensureClient(): Razorpay {
    if (!this.client) {
      throw new BusinessException('Razorpay is not configured', 503, 'RAZORPAY_NOT_CONFIGURED');
    }
    return this.client;
  }

  async createOrder(input: CreateOrderInput) {
    const client = this.ensureClient();
    return client.orders.create({
      amount: Math.round(input.amountInr * 100),
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes,
    });
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret) return false;

    const body = `${orderId}|${paymentId}`;
    const expected = createHmac('sha256', secret).update(body).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) return false;

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}