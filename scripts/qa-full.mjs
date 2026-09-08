/**
 * Full-stack QA smoke test — API endpoints + page loads per role.
 * Does not assume anything works.
 */
import { chromium } from 'playwright';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';

const failures = [];
const passes = [];

function pass(msg) {
  passes.push(msg);
  console.log(`✓ ${msg}`);
}

function fail(msg, err) {
  const detail = err instanceof Error ? err.message : String(err);
  failures.push({ msg, detail });
  console.error(`✗ ${msg}: ${detail}`);
}

async function api(path, { method = 'GET', token, body, expectFail, retries = 5 } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 429 && attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (expectFail) {
      if (res.ok && json.success) throw new Error(`Expected failure for ${path}`);
      return json;
    }
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message ?? `${path} → ${res.status}`);
    }
    return json.data;
  }
  throw new Error(`${path} exhausted retries`);
}

async function seedSession(role) {
  return api('/auth/dev-login', { method: 'POST', body: { role } });
}

const USER_PAGES = [
  '/home',
  '/favorites',
  '/invite',
  '/wallet',
  '/wallet/purchase',
  '/wallet/history',
  '/history',
  '/notifications',
  '/settings',
  '/settings/notifications',
  '/settings/communication',
  '/reports',
  '/promotions/history',
  '/profiles',
];

const HOST_PAGES = [
  '/host/dashboard',
  '/host/earnings',
  '/host/withdraw',
  '/host/history',
  '/calls/incoming',
];

const ADMIN_PAGES = [
  '/admin',
  '/admin/users',
  '/admin/hosts',
  '/admin/withdrawals',
  '/admin/payments',
  '/admin/referrals',
  '/admin/promotions',
  '/admin/reports',
  '/admin/reviews',
  '/admin/followers',
  '/admin/calls',
  '/admin/analytics',
  '/admin/notifications',
  '/admin/communications',
  '/admin/revenue',
  '/admin/risk',
];

const PUBLIC_PAGES = ['/', '/login', '/become-host', '/legal/privacy', '/legal/terms'];

async function injectAuth(page, session, role) {
  await page.context().addCookies([
    { name: 'platform_token', value: session.accessToken, url: `${WEB}/`, sameSite: 'Lax' },
  ]);
  await page.goto(`${WEB}/login`);
  await page.evaluate(
    ({ authSession, activeMode }) => {
      localStorage.setItem('platform-auth', JSON.stringify({ state: { session: authSession }, version: 0 }));
      localStorage.setItem('platform_token', authSession.accessToken);
      localStorage.setItem('platform-role-mode', JSON.stringify({ state: { activeMode }, version: 0 }));
    },
    { authSession: session, activeMode: role === 'host' ? 'host' : 'user' },
  );
}

async function loadPage(page, path) {
  const res = await page.goto(`${WEB}${path}`, { waitUntil: 'load', timeout: 45000 });
  if (!res || res.status() >= 500) throw new Error(`HTTP ${res?.status()}`);
  const text = await page.locator('body').innerText();
  if (/something went wrong|application error|unhandled runtime/i.test(text)) {
    throw new Error('Runtime error on page');
  }
}

async function testUserApis(token, hostId) {
  await api('/auth/me', { token });
  pass('GET /auth/me');
  await api('/wallet', { token });
  pass('GET /wallet');
  await api('/wallet/transactions', { token });
  pass('GET /wallet/transactions');
  await api('/hosts/discover?limit=5', { token });
  pass('GET /hosts/discover');
  await api('/favorites', { token });
  pass('GET /favorites');
  await api('/notifications', { token });
  pass('GET /notifications');
  await api('/notifications/settings', { token });
  pass('GET /notifications/settings');
  await api('/referral/me', { token });
  pass('GET /referral/me');
  await api('/payments/packages', { token });
  pass('GET /payments/packages');
  const pkgs = await api('/payments/packages', { token });
  if (pkgs?.[0]?.id) {
    await api(`/promotions/available?packageId=${pkgs[0].id}`, { token });
    pass('GET /promotions/available?packageId');
  }
  await api('/history', { token });
  pass('GET /history');
  await api('/reports/me', { token });
  pass('GET /reports/me');
  await api(`/users/${hostId}`, { token });
  pass('GET /users/:id public profile');
  await api('/communications/settings', { token });
  pass('GET /communications/settings');
}

async function testHostApis(token) {
  await api('/hosts/dashboard', { token });
  pass('GET /hosts/dashboard');
  await api('/hosts/earnings', { token });
  pass('GET /hosts/earnings');
  await api('/hosts/earnings/history', { token });
  pass('GET /hosts/earnings/history');
  await api('/hosts/status', { token });
  pass('GET /hosts/status');
  await api('/host/followers', { token });
  pass('GET /host/followers');
  await api('/calls/incoming', { token });
  pass('GET /calls/incoming');
  await api('/host/referral/stats', { token });
  pass('GET /host/referral/stats');
}

async function testAdminApis(token) {
  await api('/admin/analytics', { token });
  pass('GET /admin/analytics');
  await api('/admin/users?limit=5', { token });
  pass('GET /admin/users');
  await api('/admin/withdrawals?limit=5', { token });
  pass('GET /admin/withdrawals');
  await api('/admin/reports?limit=5', { token });
  pass('GET /admin/reports');
  await api('/admin/reviews?limit=5', { token });
  pass('GET /admin/reviews');
  await api('/admin/followers?limit=5', { token });
  pass('GET /admin/followers');
  await api('/admin/risk', { token });
  pass('GET /admin/risk');
}

async function main() {
  console.log('=== Health ===');
  try {
    await api('/health');
    pass('API health');
  } catch (e) {
    fail('API health', e);
    process.exit(1);
  }

  console.log('\n=== Auth & roles ===');
  let userSession, hostSession, adminSession;
  try {
    userSession = await seedSession('user');
    pass('dev-login user');
    hostSession = await seedSession('host');
    pass('dev-login host');
    adminSession = await seedSession('admin');
    pass('dev-login admin');
  } catch (e) {
    fail('dev-login', e);
  }

  const userToken = userSession?.accessToken;
  const hostToken = hostSession?.accessToken;
  const adminToken = adminSession?.accessToken;
  const hostId = hostSession?.user?.id;

  console.log('\n=== User APIs ===');
  if (userToken && hostId) {
    try {
      await testUserApis(userToken, hostId);
    } catch (e) {
      fail('user API suite', e);
    }
  }

  console.log('\n=== Host APIs ===');
  if (hostToken) {
    try {
      await testHostApis(hostToken);
    } catch (e) {
      fail('host API suite', e);
    }
  }

  console.log('\n=== Admin APIs ===');
  if (adminToken) {
    try {
      await testAdminApis(adminToken);
    } catch (e) {
      fail('admin API suite', e);
    }
  }

  console.log('\n=== Call flow API ===');
  if (userToken && hostId) {
    try {
      await api('/hosts/status', { method: 'PATCH', token: hostToken, body: { status: 'ONLINE' } });
      pass('PATCH /hosts/status ONLINE');
      const initiated = await api('/calls/initiate', {
        method: 'POST',
        token: userToken,
        body: { calleeId: hostId },
      });
      pass('POST /calls/initiate');
      await api(`/calls/${initiated.callId}`, { token: userToken });
      pass('GET /calls/:id');
      await api(`/calls/${initiated.callId}/consent`, {
        method: 'POST',
        token: userToken,
        body: { documentVersion: '1.0' },
      });
      pass('POST /calls/:id/consent (caller)');
      await api('/calls/incoming', { token: hostToken });
      pass('GET /calls/incoming after initiate');
      await api(`/calls/${initiated.callId}/reject`, { method: 'POST', token: hostToken });
      pass('POST /calls/:id/reject');
    } catch (e) {
      fail('call flow API', e);
    }
  }

  console.log('\n=== Page loads (Playwright) ===');
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  for (const path of PUBLIC_PAGES) {
    const page = await browser.newPage();
    try {
      await loadPage(page, path);
      pass(`page ${path}`);
    } catch (e) {
      fail(`page ${path}`, e);
    } finally {
      await page.close();
    }
  }

  if (userSession) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await injectAuth(page, userSession, 'user');
    const discover = await api('/hosts/discover?limit=1', { token: userToken });
    const profileId = discover.hosts[0]?.userId ?? hostId;
    for (const path of [...USER_PAGES, `/profiles/${profileId}`]) {
      try {
        await loadPage(page, path);
        pass(`user page ${path}`);
      } catch (e) {
        fail(`user page ${path}`, e);
      }
    }
    await ctx.close();
  }

  if (hostSession) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await injectAuth(page, hostSession, 'host');
    for (const path of HOST_PAGES) {
      try {
        await loadPage(page, path);
        pass(`host page ${path}`);
      } catch (e) {
        fail(`host page ${path}`, e);
      }
    }
    await ctx.close();
  }

  if (adminSession) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await injectAuth(page, adminSession, 'user');
    await page.goto(`${WEB}/admin/login`);
    await page.evaluate((authSession) => {
      localStorage.setItem('platform-auth', JSON.stringify({ state: { session: authSession }, version: 0 }));
    }, adminSession);
    for (const path of ADMIN_PAGES) {
      try {
        await loadPage(page, path);
        pass(`admin page ${path}`);
      } catch (e) {
        fail(`admin page ${path}`, e);
      }
    }
    await ctx.close();
  }

  await browser.close();

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passes.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length) {
    console.log(JSON.stringify(failures, null, 2));
    process.exit(1);
  }
  console.log('All QA checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});