import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const OUT = '/Users/vikasyadav/platform/screenshots/ui-redesign';
mkdirSync(OUT, { recursive: true });

async function api(path, opts = {}) {
  const { method = 'GET', token, body } = opts;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error?.message ?? `API ${path}`);
  return json.data;
}

async function loginPage(page, role, session) {
  await page.goto(`${BASE}/login`);
  await page.context().addCookies([
    { name: 'platform_token', value: session.accessToken, url: `${BASE}/`, sameSite: 'Lax' },
  ]);
  await page.evaluate(
    ({ authSession, activeMode }) => {
      localStorage.setItem('platform-auth', JSON.stringify({ state: { session: authSession }, version: 0 }));
      localStorage.setItem('platform-role-mode', JSON.stringify({ state: { activeMode }, version: 0 }));
    },
    { authSession: session, activeMode: 'user' },
  );
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function shot(page, name) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
await new Promise((r) => setTimeout(r, 2000));

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newContext({ viewport: { width: 390, height: 844 } }).then((c) => c.newPage());

await loginPage(page, 'user', userSession);

await page.goto(`${BASE}/home`);
await shot(page, '01-home');

const hosts = await api('/hosts/discover?limit=1', { token: userSession.accessToken });
const hostId = hosts.hosts[0]?.userId;
if (hostId) {
  await page.goto(`${BASE}/profiles/${hostId}`);
  await shot(page, '02-profile');
}

const initiated = await api('/calls/initiate', {
  method: 'POST',
  token: userSession.accessToken,
  body: { calleeId: hostId },
});
await api(`/calls/${initiated.callId}/consent`, {
  method: 'POST',
  token: userSession.accessToken,
  body: { documentVersion: '1.0' },
});

await page.goto(`${BASE}/calls/${initiated.callId}`);
const agree = page.getByRole('button', { name: /I agree/i });
if (await agree.isVisible({ timeout: 8000 }).catch(() => false)) {
  await agree.click();
  await page.waitForTimeout(2000);
}
await shot(page, '03-video-call');

await browser.close();
console.log('Screenshots saved to', OUT);