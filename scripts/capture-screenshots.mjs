import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const OUT = '/Users/vikasyadav/platform/screenshots';
mkdirSync(OUT, { recursive: true });

async function devLogin(page, role) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  const labels = { user: 'User', host: 'Host', admin: 'Admin' };
  await page.getByRole('button', { name: labels[role] }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

async function shot(page, name) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await devLogin(page, 'user');
await page.goto(`${BASE}/wallet/purchase`);
await shot(page, 'wallet-purchase');

await devLogin(page, 'host');
await page.goto(`${BASE}/host/dashboard`);
await shot(page, 'host-dashboard');
await page.goto(`${BASE}/host/earnings`);
await shot(page, 'host-earnings');
await page.goto(`${BASE}/host/withdraw`);
await shot(page, 'host-withdraw');

await page.setViewportSize({ width: 1280, height: 800 });
await devLogin(page, 'admin');
await page.goto(`${BASE}/admin`);
await shot(page, 'admin-dashboard');

await browser.close();
console.log('Screenshots saved to', OUT);