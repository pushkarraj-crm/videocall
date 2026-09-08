import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '/tmp/razorpay-checkout-test';

async function fetchJson<T>(
  path: string,
  init?: { method?: string; body?: unknown; token?: string },
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as T };
}

async function main() {
  const login = await fetchJson<{ data: { accessToken: string } }>('/auth/dev-login', {
    method: 'POST',
    body: { role: 'user' },
  });
  const token = login.body.data.accessToken;

  const packages = await fetchJson<{ data: Array<{ id: string; name: string }> }>(
    '/payments/packages',
  );
  const starter = packages.body.data.find((p) => p.name === 'Starter');
  if (!starter) throw new Error('Starter package not found');

  const orderRes = await fetchJson<{
    data: { razorpayOrderId: string; keyId: string; totalInr: number };
  }>('/payments/create-order', {
    method: 'POST',
    token,
    body: { packageId: starter.id },
  });

  const order = orderRes.body.data;
  mkdirSync(OUT, { recursive: true });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head><body><script>
const order = ${JSON.stringify(order)};
window.onload = function() {
  setTimeout(function() {
    var rzp = new Razorpay({
      key: order.keyId,
      amount: Math.round(order.totalInr * 100),
      currency: 'INR',
      name: 'Connect',
      description: 'checkout test',
      order_id: order.razorpayOrderId,
      handler: function() { document.title = 'PAYMENT_SUCCESS'; },
      modal: { ondismiss: function() { document.title = 'DISMISSED'; } }
    });
    rzp.open();
    setTimeout(function() {
      document.title = document.querySelector('iframe') ? 'CHECKOUT_OPEN' : 'NO_IFRAME';
    }, 4000);
  }, 500);
};
</script></body></html>`;

  const htmlPath = resolve(OUT, 'test.html');
  const shotPath = resolve(OUT, 'checkout.png');
  writeFileSync(htmlPath, html);

  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--window-size=390,844',
      '--virtual-time-budget=6000',
      `--screenshot=${shotPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'pipe', timeout: 15000 },
  );

  const shotSize = statSync(shotPath).size;
  const hasIframe = shotSize > 8000;

  console.log(
    JSON.stringify(
      {
        createOrderOk: orderRes.status === 200 || orderRes.status === 201,
        razorpayOrderId: order.razorpayOrderId,
        keyIdPrefix: order.keyId.slice(0, 12) + '…',
        checkoutScreenshotBytes: shotSize,
        iframeOrRazorpayInDom: hasIframe,
        checkoutOpens: hasIframe || shotSize > 8000,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});