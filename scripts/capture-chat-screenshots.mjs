import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const OUT = '/Users/vikasyadav/platform/screenshots/chat';
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

async function loginPage(page, session) {
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
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });

const hosts = await api('/hosts/discover?limit=1', { token: userSession.accessToken });
const hostId = hosts.hosts[0]?.userId ?? hostSession.user.id;

// Create conversation via direct DB-like approach: use getOrCreate via internal API if available
// Since no create endpoint, insert via prisma script or use existing conversations
let conversations = await api('/conversations', { token: userSession.accessToken });

if (!conversations.length) {
  const { execSync } = await import('child_process');
  execSync(
    `cd /Users/vikasyadav/platform/apps/api && npx ts-node scripts/seed-chat-demo.ts ${userSession.user.id} ${hostId}`,
    { stdio: 'inherit' },
  );
  conversations = await api('/conversations', { token: userSession.accessToken });
}

const convId = conversations[0]?.id;
if (!convId) throw new Error('No conversation created');

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

// Desktop chat list
const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then((c) => c.newPage());
await loginPage(desktop, userSession);
await desktop.goto(`${BASE}/messages`);
await shot(desktop, '01-chat-list-desktop');
await desktop.close();

// Mobile chat list
const mobileList = await browser.newContext({ viewport: { width: 390, height: 844 } }).then((c) => c.newPage());
await loginPage(mobileList, userSession);
await mobileList.goto(`${BASE}/messages`);
await shot(mobileList, '02-chat-list-mobile');
await mobileList.close();

// Mobile chat room
const mobileRoom = await browser.newContext({ viewport: { width: 390, height: 844 } }).then((c) => c.newPage());
await loginPage(mobileRoom, userSession);
await mobileRoom.goto(`${BASE}/messages/${convId}`);
await shot(mobileRoom, '03-chat-room-mobile');
await mobileRoom.close();

// Desktop chat room
const desktopRoom = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then((c) => c.newPage());
await loginPage(desktopRoom, userSession);
await desktopRoom.goto(`${BASE}/messages/${convId}`);
await shot(desktopRoom, '04-chat-room-desktop');
await desktopRoom.close();

await browser.close();
console.log(`Screenshots saved to ${OUT}`);