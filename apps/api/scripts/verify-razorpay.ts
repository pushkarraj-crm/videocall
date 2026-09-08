import { createHmac, timingSafeEqual } from 'crypto';

function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  console.log('Env:', {
    RAZORPAY_KEY_ID: keyId ? `${keyId.slice(0, 8)}…` : 'MISSING',
    RAZORPAY_KEY_SECRET: keySecret ? 'SET' : 'MISSING',
    RAZORPAY_WEBHOOK_SECRET: webhookSecret ? 'SET' : 'MISSING',
  });

  const base = process.env.API_URL ?? 'http://localhost:3001/v1';
  const res = await fetch(`${base}/payments/razorpay/status`);
  console.log('API /payments/razorpay/status:', await res.json());

  if (keySecret) {
    const orderId = 'order_test';
    const paymentId = 'pay_test';
    const sig = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    console.log('Payment signature:', {
      valid: verifyPaymentSignature(orderId, paymentId, sig, keySecret),
      invalid: verifyPaymentSignature(orderId, paymentId, 'x', keySecret),
    });
  }

  if (webhookSecret) {
    const body = '{"event":"payment.captured"}';
    const sig = createHmac('sha256', webhookSecret).update(body).digest('hex');
    console.log('Webhook signature:', { valid: verifyWebhookSignature(body, sig, webhookSecret) });
  }
}

main();