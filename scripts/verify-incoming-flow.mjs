import { chromium } from 'playwright';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';

async function api(path, { method = 'GET', token, body, retries = 6 } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (res.status === 429 && attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message ?? `API ${path} failed (${res.status})`);
    }
    return json.data;
  }
  throw new Error(`API ${path} exhausted retries`);
}

async function loginPage(page, role, session) {
  await page.goto(`${WEB}/login`);
  await page.context().addCookies([
    { name: 'platform_token', value: session.accessToken, url: `${WEB}/`, sameSite: 'Lax' },
  ]);
  await page.evaluate(
    ({ authSession, activeMode }) => {
      localStorage.setItem('platform-auth', JSON.stringify({ state: { session: authSession }, version: 0 }));
      localStorage.setItem('platform_token', authSession.accessToken);
      localStorage.setItem(
        'platform-role-mode',
        JSON.stringify({ state: { activeMode }, version: 0 }),
      );
    },
    { authSession: session, activeMode: role === 'host' ? 'host' : 'user' },
  );
  await page.reload();
  await page.waitForLoadState('load');
}

const callerSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
await new Promise((r) => setTimeout(r, 2000));
const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });

await api('/hosts/status', {
  method: 'PATCH',
  token: hostSession.accessToken,
  body: { status: 'ONLINE' },
});

const discover = await api('/hosts/discover?limit=10', { token: callerSession.accessToken });
const targetHost = discover.hosts.find((h) => h.userId === hostSession.user.id) ?? discover.hosts[0];

if (!targetHost) throw new Error('No hosts in discover');

const idMatch = targetHost.userId === hostSession.user.id;

const initiated = await api('/calls/initiate', {
  method: 'POST',
  token: callerSession.accessToken,
  body: { calleeId: targetHost.userId },
});

const callRow = await api(`/calls/${initiated.callId}`, { token: callerSession.accessToken });
const incomingForHost = await api('/calls/incoming', { token: hostSession.accessToken });
const hostSeesCall = incomingForHost.calls.some((c) => c.callId === initiated.callId);

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const hostPage = await browser.newContext({ permissions: ['camera', 'microphone'] }).then((c) => c.newPage());
const callerPage = await browser.newContext({ permissions: ['camera', 'microphone'] }).then((c) => c.newPage());

const hostLogs = [];
const callerLogs = [];
hostPage.on('console', (m) => {
  const t = m.text();
  if (/HOST_|INCOMING_|CALL_|LOCAL_CAMERA/.test(t)) hostLogs.push(t);
});
callerPage.on('console', (m) => {
  const t = m.text();
  if (/CALL_|LOCAL_CAMERA/.test(t)) callerLogs.push(t);
});

await loginPage(hostPage, 'host', hostSession);
await loginPage(callerPage, 'user', callerSession);

await api(`/calls/${initiated.callId}/consent`, {
  method: 'POST',
  token: callerSession.accessToken,
  body: { documentVersion: '1.0' },
});

await callerPage.goto(`${WEB}/calls/${initiated.callId}`);
await callerPage.waitForLoadState('load');
const agree = callerPage.getByRole('button', { name: /I agree/i });
if (await agree.isVisible({ timeout: 5000 }).catch(() => false)) {
  await agree.click();
  await callerPage.waitForTimeout(2000);
}
await callerPage.waitForFunction(
  () =>
    document.body.innerText.includes('Waiting for host') ||
    document.body.innerText.includes('Connecting'),
  null,
  { timeout: 45000 },
);

await hostPage.goto(`${WEB}/host/dashboard`);
await hostPage.waitForLoadState('load');
await hostPage.waitForTimeout(4000);

const incomingUi = await hostPage.locator('body').innerText();
const redirectedIncoming = hostPage.url().includes('/calls/incoming');
await hostPage.goto(`${WEB}/calls/incoming`);
await hostPage.waitForTimeout(3000);
const incomingPageText = await hostPage.locator('body').innerText();

await browser.close();

const result = {
  callerId: callerSession.user.id,
  hostId: hostSession.user.id,
  discoverHostId: targetHost.userId,
  discoverIdMatchesLoggedInHost: idMatch,
  callId: initiated.callId,
  dbCalleeId: callRow.calleeId,
  dbCallerId: callRow.callerId,
  dbCalleeMatchesHost: callRow.calleeId === hostSession.user.id,
  apiIncomingCount: incomingForHost.calls.length,
  hostSeesCallViaApi: hostSeesCall,
  hostDashboardHadIncoming: incomingUi.toLowerCase().includes('incoming'),
  hostAutoRedirected: redirectedIncoming,
  incomingPageShowsRinging: incomingPageText.includes('Incoming video call'),
  callerLocalCameraLog: callerLogs.some((l) => l.includes('LOCAL_CAMERA_STARTED')),
  hostNotifyLogs: hostLogs.filter((l) => /HOST_NOTIFY|INCOMING_CALL/.test(l)),
  callerLogs,
  hostLogs,
  passed:
    callRow.calleeId === hostSession.user.id &&
    hostSeesCall &&
    incomingPageText.includes('Incoming video call') &&
    callerLogs.some((l) => l.includes('LOCAL_CAMERA_STARTED')),
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);