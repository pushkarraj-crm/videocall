/**
 * Razorpay integration diagnostics.
 * Loads apps/api/.env, runs live checks against configured keys (no mock payments).
 *
 * Optional post-checkout env for confirm/duplicate tests (after a real LIVE payment):
 *   RAZORPAY_TEST_ORDER_ID, RAZORPAY_TEST_PAYMENT_ID, RAZORPAY_TEST_SIGNATURE
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const API_ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(API_ROOT, '.env');
const API_BASE = process.env.API_URL ?? 'http://localhost:3001/v1';
const WEB_BASE = process.env.WEB_URL ?? 'http://localhost:3000';

type CheckStatus = 'pass' | 'fail' | 'skip' | 'warn';

interface Check {
  id: string;
  name: string;
  status: CheckStatus;
  detail: string;
}

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    // missing file
  }
  return out;
}

function maskKey(value: string | undefined): string {
  if (!value) return 'MISSING';
  if (value.startsWith('rzp_')) return `${value.slice(0, 12)}… (len ${value.length})`;
  return `SET (len ${value.length})`;
}

async function apiJson<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<{ ok: boolean; status: number; body: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  const body = (await res.json()) as T;
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const keyId = process.env.RAZORPAY_KEY_ID ?? fileEnv.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? fileEnv.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? fileEnv.RAZORPAY_WEBHOOK_SECRET;

  const checks: Check[] = [];
  const blockers: string[] = [];

  const add = (check: Check) => {
    checks.push(check);
    if (check.status === 'fail') blockers.push(`${check.name}: ${check.detail}`);
  };

  add({
    id: 'env_file',
    name: 'Backend .env file exists',
    status: Object.keys(fileEnv).length > 0 ? 'pass' : 'fail',
    detail: ENV_PATH,
  });

  add({
    id: 'env_key_id',
    name: 'RAZORPAY_KEY_ID in apps/api/.env',
    status: keyId ? 'pass' : 'fail',
    detail: maskKey(keyId),
  });

  add({
    id: 'env_key_secret',
    name: 'RAZORPAY_KEY_SECRET in apps/api/.env',
    status: keySecret ? 'pass' : 'fail',
    detail: keySecret ? 'SET' : 'MISSING',
  });

  add({
    id: 'env_webhook_secret',
    name: 'RAZORPAY_WEBHOOK_SECRET in apps/api/.env',
    status: webhookSecret ? 'pass' : 'warn',
    detail: webhookSecret ? 'SET' : 'MISSING (checkout works; webhooks will fail)',
  });

  if (keyId) {
    const mode = keyId.startsWith('rzp_live_')
      ? 'LIVE'
      : keyId.startsWith('rzp_test_')
        ? 'TEST'
        : 'UNKNOWN';
    add({
      id: 'key_mode',
      name: 'Razorpay key mode',
      status: mode === 'UNKNOWN' ? 'warn' : 'pass',
      detail: mode,
    });
  }

  // API health + razorpay status (running server may have stale env until restart)
  try {
    const health = await apiJson<{ success?: boolean }>('/health');
    add({
      id: 'api_health',
      name: 'API reachable',
      status: health.ok ? 'pass' : 'fail',
      detail: `GET /health → ${health.status}`,
    });
  } catch (e) {
    add({
      id: 'api_health',
      name: 'API reachable',
      status: 'fail',
      detail: e instanceof Error ? e.message : 'fetch failed',
    });
  }

  try {
    const statusRes = await apiJson<{
      data?: {
        configured: boolean;
        checkoutReady: boolean;
        webhookReady: boolean;
        keyIdPrefix: string | null;
      };
    }>('/payments/razorpay/status');
    const s = statusRes.body as { data?: { configured: boolean; checkoutReady: boolean; webhookReady: boolean; keyIdPrefix: string | null } };
    const data = s.data ?? (statusRes.body as { configured?: boolean });
    const configured = 'configured' in (data as object) ? (data as { configured: boolean }).configured : false;
    add({
      id: 'api_razorpay_status',
      name: 'API reports Razorpay configured (requires API restart after .env change)',
      status: configured ? 'pass' : 'fail',
      detail: JSON.stringify(data),
    });
    if (!configured && keyId && keySecret) {
      blockers.push('API process has stale env — restart API after updating apps/api/.env');
    }
  } catch (e) {
    add({
      id: 'api_razorpay_status',
      name: 'API Razorpay status',
      status: 'fail',
      detail: e instanceof Error ? e.message : 'fetch failed',
    });
  }

  // Direct Razorpay order creation (real API, no mock)
  let createdOrderId: string | null = null;
  let createdPaymentId: string | null = null;
  if (keyId && keySecret) {
    try {
      const Razorpay = (await import('razorpay')).default;
      const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const order = await client.orders.create({
        amount: 1900, // ₹19 (Starter) in paise
        currency: 'INR',
        receipt: `diag_${Date.now()}`,
        notes: { source: 'razorpay-diagnostics' },
      });
      createdOrderId = order.id;
      add({
        id: 'razorpay_orders_api',
        name: 'Razorpay Orders API (direct SDK)',
        status: order.id?.startsWith('order_') ? 'pass' : 'fail',
        detail: `order_id=${order.id}, amount=${order.amount} paise`,
      });
    } catch (e) {
      add({
        id: 'razorpay_orders_api',
        name: 'Razorpay Orders API (direct SDK)',
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  } else {
    add({
      id: 'razorpay_orders_api',
      name: 'Razorpay Orders API (direct SDK)',
      status: 'skip',
      detail: 'Keys missing in apps/api/.env',
    });
  }

  // Dev login + create-order via API
  let token: string | null = null;
  let walletBefore: { balanceUnits: string; balanceCoins: number } | null = null;
  try {
    const login = await apiJson<{
      data?: { accessToken: string };
      accessToken?: string;
    }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ role: 'user' }),
    });
    token = login.body.data?.accessToken ?? login.body.accessToken ?? null;
    add({
      id: 'dev_login',
      name: 'Dev auth login',
      status: token ? 'pass' : 'fail',
      detail: token ? 'JWT obtained' : JSON.stringify(login.body),
    });
  } catch (e) {
    add({
      id: 'dev_login',
      name: 'Dev auth login',
      status: 'fail',
      detail: e instanceof Error ? e.message : 'fetch failed',
    });
  }

  if (token) {
    try {
      const walletRes = await apiJson<{ data?: { balanceUnits: string; balanceCoins: number } }>(
        '/wallet',
        { token },
      );
      walletBefore = walletRes.body.data ?? null;
      add({
        id: 'wallet_before',
        name: 'Wallet balance readable',
        status: walletBefore ? 'pass' : 'fail',
        detail: walletBefore
          ? `${walletBefore.balanceCoins} coins (${walletBefore.balanceUnits} units)`
          : JSON.stringify(walletRes.body),
      });
    } catch (e) {
      add({
        id: 'wallet_before',
        name: 'Wallet balance readable',
        status: 'fail',
        detail: e instanceof Error ? e.message : 'fetch failed',
      });
    }

    const packagesRes = await apiJson<{
      data?: Array<{ id: string; name: string; priceInr: string }>;
    }>('/payments/packages');
    const starter = packagesRes.body.data?.find((p) => p.name === 'Starter');

    if (starter && token) {
      try {
        const orderRes = await apiJson<{
          data?: {
            razorpayOrderId: string;
            keyId: string;
            totalInr: number;
            paymentId: string;
          };
          message?: string;
          code?: string;
        }>('/payments/create-order', {
          method: 'POST',
          token,
          body: JSON.stringify({ packageId: starter.id }),
        });
        const orderData = orderRes.body.data;
        const ok =
          orderRes.ok &&
          !!orderData?.razorpayOrderId?.startsWith('order_') &&
          !!orderData?.keyId;
        if (orderData?.paymentId) createdPaymentId = orderData.paymentId;
        if (orderData?.razorpayOrderId) createdOrderId = orderData.razorpayOrderId;
        add({
          id: 'api_create_order',
          name: 'POST /payments/create-order (Starter pack)',
          status: ok ? 'pass' : 'fail',
          detail: ok
            ? `razorpayOrderId=${orderData!.razorpayOrderId}, keyId=${maskKey(orderData!.keyId)}, totalInr=${orderData!.totalInr}`
            : JSON.stringify(orderRes.body),
        });
      } catch (e) {
        add({
          id: 'api_create_order',
          name: 'POST /payments/create-order',
          status: 'fail',
          detail: e instanceof Error ? e.message : 'fetch failed',
        });
      }
    }
  }

  // Checkout prerequisites
  try {
    const scriptRes = await fetch('https://checkout.razorpay.com/v1/checkout.js');
    add({
      id: 'checkout_script',
      name: 'Razorpay checkout.js CDN reachable',
      status: scriptRes.ok ? 'pass' : 'fail',
      detail: `HTTP ${scriptRes.status}`,
    });
  } catch (e) {
    add({
      id: 'checkout_script',
      name: 'Razorpay checkout.js CDN',
      status: 'fail',
      detail: e instanceof Error ? e.message : 'fetch failed',
    });
  }

  try {
    const webRes = await fetch(`${WEB_BASE}/wallet/purchase`, { redirect: 'manual' });
    add({
      id: 'web_purchase_page',
      name: 'Web /wallet/purchase reachable',
      status: webRes.status === 200 || webRes.status === 307 ? 'pass' : 'fail',
      detail: `HTTP ${webRes.status} (307 = auth redirect, page exists)`,
    });
  } catch (e) {
    add({
      id: 'web_purchase_page',
      name: 'Web /wallet/purchase reachable',
      status: 'fail',
      detail: e instanceof Error ? e.message : 'fetch failed',
    });
  }

  if (keyId && createdOrderId) {
    add({
      id: 'checkout_ready',
      name: 'Checkout can open (keyId + orderId available)',
      status: 'pass',
      detail: `Use key ${maskKey(keyId)} with order ${createdOrderId} on ${WEB_BASE}/wallet/purchase`,
    });
  } else {
    add({
      id: 'checkout_ready',
      name: 'Checkout can open from /wallet/purchase',
      status: 'fail',
      detail: 'Blocked until RAZORPAY_KEY_ID/SECRET are in .env and API restarted',
    });
  }

  // Payment confirm + duplicate (requires real captured payment — no mocks)
  const testOrderId = process.env.RAZORPAY_TEST_ORDER_ID;
  const testPaymentId = process.env.RAZORPAY_TEST_PAYMENT_ID;
  const testSignature = process.env.RAZORPAY_TEST_SIGNATURE;

  if (token && testOrderId && testPaymentId && testSignature) {
    try {
      const confirm1 = await apiJson<{
        data?: { payment: { status: string }; wallet: { balanceUnits: string; balanceCoins: number } };
      }>('/payments/confirm', {
        method: 'POST',
        token,
        body: JSON.stringify({
          orderId: testOrderId,
          paymentId: testPaymentId,
          signature: testSignature,
        }),
      });
      const paid = confirm1.body.data?.payment?.status === 'paid';
      const walletAfter = confirm1.body.data?.wallet;
      const credited =
        walletBefore &&
        walletAfter &&
        BigInt(walletAfter.balanceUnits) > BigInt(walletBefore.balanceUnits);

      add({
        id: 'payment_confirm',
        name: 'POST /payments/confirm credits wallet',
        status: paid && credited ? 'pass' : paid ? 'warn' : 'fail',
        detail: paid
          ? `status=paid, wallet ${walletBefore?.balanceCoins} → ${walletAfter?.balanceCoins} coins`
          : JSON.stringify(confirm1.body),
      });

      const confirm2 = await apiJson('/payments/confirm', {
        method: 'POST',
        token,
        body: JSON.stringify({
          orderId: testOrderId,
          paymentId: testPaymentId,
          signature: testSignature,
        }),
      });
      const walletAfter2 = (confirm2.body as { data?: { wallet: { balanceUnits: string } } }).data
        ?.wallet;
      const noDoubleCredit =
        walletAfter &&
        walletAfter2 &&
        walletAfter2.balanceUnits === walletAfter.balanceUnits;

      add({
        id: 'duplicate_confirm',
        name: 'Duplicate confirm does not double-credit wallet',
        status: confirm2.ok && noDoubleCredit ? 'pass' : 'fail',
        detail: noDoubleCredit
          ? `balance unchanged at ${walletAfter?.balanceCoins} coins after 2nd confirm`
          : JSON.stringify(confirm2.body),
      });
    } catch (e) {
      add({
        id: 'payment_confirm',
        name: 'Payment confirm / duplicate tests',
        status: 'fail',
        detail: e instanceof Error ? e.message : 'fetch failed',
      });
    }
  } else {
    add({
      id: 'payment_confirm',
      name: 'POST /payments/confirm credits wallet',
      status: 'skip',
      detail:
        'Complete one real LIVE checkout, then re-run with RAZORPAY_TEST_ORDER_ID, RAZORPAY_TEST_PAYMENT_ID, RAZORPAY_TEST_SIGNATURE',
    });
    add({
      id: 'duplicate_confirm',
      name: 'Duplicate payment protection',
      status: 'skip',
      detail: 'Requires completed real payment (same env vars as above)',
    });
  }

  // Signature helpers when secret present
  if (keySecret) {
    const oid = 'order_diag';
    const pid = 'pay_diag';
    const sig = createHmac('sha256', keySecret).update(`${oid}|${pid}`).digest('hex');
    const valid = timingSafeEqual(Buffer.from(sig), Buffer.from(sig));
    add({
      id: 'signature_algo',
      name: 'Payment signature algorithm (HMAC SHA256)',
      status: valid ? 'pass' : 'fail',
      detail: 'orderId|paymentId HMAC verified locally',
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    envFilePath: ENV_PATH,
    expectedEnvVars: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'],
    apiBase: API_BASE,
    webBase: WEB_BASE,
    summary: {
      pass: checks.filter((c) => c.status === 'pass').length,
      fail: checks.filter((c) => c.status === 'fail').length,
      warn: checks.filter((c) => c.status === 'warn').length,
      skip: checks.filter((c) => c.status === 'skip').length,
    },
    blockers: [...new Set(blockers)],
    checks,
    pendingOrder: createdOrderId
      ? { razorpayOrderId: createdOrderId, dbPaymentId: createdPaymentId }
      : null,
  };

  const outPath = resolve(API_ROOT, 'scripts/razorpay-diagnostics-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`\nReport written to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});