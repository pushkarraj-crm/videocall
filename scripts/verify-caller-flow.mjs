import { chromium } from 'playwright';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';

async function api(path, { method = 'GET', token, body, retries = 5 } = {}) {
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

const logs = { user: [], host: [] };

function attachConsole(page, bucket) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      /CALL_|ZEGO_|CONNECTED|LOCAL_|REMOTE_|USER_|HOST_|PUBLISH/.test(text)
    ) {
      bucket.push(text);
    }
  });
}

const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
await new Promise((r) => setTimeout(r, 2000));
const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const userPage = await browser.newContext({ permissions: ['camera', 'microphone'] }).then((c) => c.newPage());
const hostPage = await browser.newContext({ permissions: ['camera', 'microphone'] }).then((c) => c.newPage());
attachConsole(userPage, logs.user);
attachConsole(hostPage, logs.host);

await loginPage(userPage, 'user', userSession);
await loginPage(hostPage, 'host', hostSession);

await api('/hosts/status', {
  method: 'PATCH',
  token: hostSession.accessToken,
  body: { status: 'ONLINE' },
});

const hostId = hostSession.user.id;
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

await userPage.goto(`${WEB}/calls/${initiated.callId}`);
await userPage.waitForLoadState('load');
const userAgree = userPage.getByRole('button', { name: /I agree/i });
if (await userAgree.isVisible({ timeout: 20000 }).catch(() => false)) {
  await userAgree.click();
  await userPage.waitForTimeout(1000);
}
await userPage.waitForFunction(
  () =>
    document.body.innerText.includes('Waiting for host') ||
    document.body.innerText.includes('Connecting'),
  null,
  { timeout: 45000 },
);

await api(`/calls/${initiated.callId}/consent`, {
  method: 'POST',
  token: hostSession.accessToken,
  body: { documentVersion: '1.0' },
});
await api(`/calls/${initiated.callId}/accept`, { method: 'POST', token: hostSession.accessToken });

await hostPage.goto(`${WEB}/calls/${initiated.callId}`);
await hostPage.waitForLoadState('load');
const hostAgree = hostPage.getByRole('button', { name: /I agree/i });
if (await hostAgree.isVisible({ timeout: 5000 }).catch(() => false)) {
  await hostAgree.click();
}

await userPage.waitForFunction(
  () =>
    !document.body.innerText.includes('Waiting for host') &&
    !document.body.innerText.includes('Connecting'),
  null,
  { timeout: 90000 },
);
await hostPage.waitForFunction(
  () => !document.body.innerText.includes('Connecting'),
  null,
  { timeout: 90000 },
);

await userPage.waitForTimeout(4000);
await hostPage.waitForTimeout(4000);

const userText = await userPage.locator('body').innerText();
const hostText = await hostPage.locator('body').innerText();
const userEndVisible = await userPage.locator('button[aria-label="End call"]').isVisible().catch(() => false);
const hostEndVisible = await hostPage.locator('button[aria-label="End call"]').isVisible().catch(() => false);

if (userEndVisible) {
  await userPage.locator('button[aria-label="End call"]').click();
}

await userPage.waitForURL((url) => !url.pathname.includes('/calls/'), { timeout: 30000 }).catch(() => {});

let callStatus = 'unknown';
try {
  const call = await api(`/calls/${initiated.callId}`, { token: userSession.accessToken, retries: 8 });
  callStatus = call.status;
} catch (err) {
  callStatus = `error:${err.message}`;
}

await browser.close();

const result = {
  callId: initiated.callId,
  userLeftWaiting: !userText.includes('Waiting for host'),
  userEndVisible,
  hostEndVisible,
  userAcceptedLog: logs.user.some((l) => l.includes('CALL_ACCEPTED')),
  userPollLog: logs.user.some((l) => l.includes('CALL_STATUS_POLL')),
  userJoinLog: logs.user.some((l) => /USER_JOINED|LOCAL_STREAM_CREATED/.test(l)),
  hostJoinLog: logs.host.some((l) => /HOST_JOINED|LOCAL_STREAM_CREATED/.test(l)),
  userConnectedLog: logs.user.some((l) => l.includes('CONNECTED')),
  hostConnectedLog: logs.host.some((l) => l.includes('CONNECTED')),
  callStatus,
  userLogs: logs.user,
  hostLogs: logs.host,
  passed:
    logs.user.some((l) => l.includes('CALL_ACCEPTED')) &&
    logs.user.some((l) => /USER_JOINED|LOCAL_STREAM_CREATED/.test(l)) &&
    logs.host.some((l) => /HOST_JOINED|LOCAL_STREAM_CREATED/.test(l)) &&
    userEndVisible &&
    hostEndVisible &&
    !userText.includes('Waiting for host'),
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);