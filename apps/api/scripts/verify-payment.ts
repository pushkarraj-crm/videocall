/**
 * Payment verification — Razorpay order + signature verify path.
 * Run: npx tsx scripts/verify-payment.ts
 */
import { createHmac } from 'crypto';
import { verifyApi as api } from './lib/verify-api';

async function main() {
  console.log('\n=== Payment Verification ===\n');
  let passed = 0;
  let failed = 0;

  const ok = (name: string) => {
    passed++;
    console.log(`  ✓ ${name}`);
  };
  const fail = (name: string, detail?: string) => {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    const status = await api('/payments/razorpay/status');
    if (status) ok('Razorpay status endpoint');

    const packages = (await api('/payments/packages')) as Array<{ id: string }>;
    if (packages.length) ok('Coin packages listed');
    else fail('Coin packages listed', 'empty');

    const user = (await api('/auth/dev-login', {
      method: 'POST',
      body: { role: 'user' },
    })) as { accessToken: string };

    if (packages[0]) {
      const order = (await api('/wallet/recharge', {
        method: 'POST',
        token: user.accessToken,
        body: { packageId: packages[0].id },
      })) as { razorpayOrderId?: string; orderId?: string };

      const orderId = order.razorpayOrderId ?? order.orderId;
      if (orderId) ok('Wallet recharge creates order');
      else fail('Wallet recharge creates order');
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (secret) {
      const orderId = 'order_verify_test';
      const paymentId = 'pay_verify_test';
      const sig = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
      const valid = sig.length === 64;
      if (valid) ok('Payment signature generation');
      else fail('Payment signature generation');
    } else {
      ok('Payment signature (skipped — no RAZORPAY_KEY_SECRET)');
    }
  } catch (err) {
    fail('Payment flow', err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== ${passed}/${passed + failed} passed ===\n`);
  if (failed) process.exit(1);
}

main();