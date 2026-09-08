import { chromium } from 'playwright';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const WEB = process.env.WEB_URL ?? 'http://localhost:3000';

async function api(path, { method = 'GET', token, body } = {}, attempt = 0) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (res.status === 429 && attempt < 12) {
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    return api(path, { method, token, body }, attempt + 1);
  }
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `API ${path} failed (${res.status})`);
  }
  return json.data;
}

async function devLogin(role) {
  const session = await api('/auth/dev-login', { method: 'POST', body: { role } });
  return { session, token: session.accessToken, userId: session.user.id };
}

async function loginPage(page, role, session) {
  await page.goto(`${WEB}/login`);
  await page.context().addCookies([
    { name: 'platform_token', value: session.accessToken, url: `${WEB}/`, sameSite: 'Lax' },
  ]);
  await page.evaluate(
    ({ authSession, activeMode }) => {
      const token = authSession.accessToken;
      localStorage.setItem('platform_token', token);
      document.cookie = `platform_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      localStorage.setItem(
        'platform-auth',
        JSON.stringify({ state: { session: authSession }, version: 0 }),
      );
      localStorage.setItem(
        'platform-role-mode',
        JSON.stringify({ state: { activeMode }, version: 0 }),
      );
    },
    { authSession: session, activeMode: role === 'host' ? 'host' : 'user' },
  );
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function consentToCall(page) {
  const agree = page.getByRole('button', { name: /I agree/i });
  if (await agree.isVisible({ timeout: 20000 }).catch(() => false)) {
    await agree.click();
    await page.waitForTimeout(1000);
  }
}

function attachConsole(page, bucket) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      /CALL_CREATED|CALL_ACCEPTED|CALL_STATUS_POLL|USER_JOINED|HOST_JOINED|LOCAL_STREAM_CREATED|REMOTE_STREAM_RECEIVED|CONNECTED|CALL_ENDED|CALL_ENDED_SYNC|ZEGO_LOGIN_START|ZEGO_LOGIN_SUCCESS|ZEGO_ROOM_CONNECTED|PUBLISH_START|PUBLISH_SUCCESS|PUBLISH_FAILED/.test(
        text,
      )
    ) {
      bucket.push(text);
    }
  });
}

async function runCallRound({
  round,
  userPage,
  hostPage,
  userAuth,
  hostAuth,
  hostId,
  logs,
}) {
  logs.user.length = 0;
  logs.host.length = 0;

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: userAuth.token,
    body: { calleeId: hostId },
  });
  console.info(`CALL_CREATED round=${round}`, { callId: initiated.callId });

  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: userAuth.token,
    body: { documentVersion: '1.0' },
  });

  await userPage.goto(`${WEB}/calls/${initiated.callId}`);
  await userPage.waitForLoadState('networkidle');
  await consentToCall(userPage);
  await userPage.waitForFunction(
    () => {
      const text = document.body.innerText;
      return (
        text.includes('Waiting for host') ||
        text.includes('Connecting') ||
        text.includes('Calling host') ||
        document.querySelector('button[aria-label="End call"]')
      );
    },
    null,
    { timeout: 60000 },
  );

  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: hostAuth.token,
    body: { documentVersion: '1.0' },
  });
  await api(`/calls/${initiated.callId}/accept`, { method: 'POST', token: hostAuth.token });

  await hostPage.goto(`${WEB}/calls/${initiated.callId}`);
  await hostPage.waitForLoadState('networkidle');
  await consentToCall(hostPage);

  await userPage.waitForFunction(
    () => {
      const text = document.body.innerText;
      return (
        !text.includes('Connecting') &&
        !text.includes('Waiting for host') &&
        !text.includes('I agree') &&
        !text.includes('Loading call')
      );
    },
    null,
    { timeout: 90000 },
  );
  await hostPage.waitForFunction(
    () => {
      const text = document.body.innerText;
      return (
        !text.includes('Connecting') &&
        !text.includes('I agree') &&
        !text.includes('Loading call') &&
        !text.includes('Could not join')
      );
    },
    null,
    { timeout: 90000 },
  );

  await userPage.waitForTimeout(3000);
  await hostPage.waitForTimeout(3000);

  const userAcceptedLog = logs.user.some((line) => /CALL_ACCEPTED/.test(line));
  const userJoinLog = logs.user.some((line) => /USER_JOINED|LOCAL_STREAM_CREATED/.test(line));
  const hostJoinLog = logs.host.some((line) => /HOST_JOINED|LOCAL_STREAM_CREATED/.test(line));
  const userConnectedLog = logs.user.some((line) => /CONNECTED/.test(line));
  const hostLoginSuccess = logs.host.some((line) => /ZEGO_LOGIN_SUCCESS/.test(line));
  const hostRoomConnected = logs.host.some((line) => /ZEGO_ROOM_CONNECTED/.test(line));
  const hostPublishSuccess = logs.host.some((line) => /PUBLISH_SUCCESS/.test(line));
  const hostPublishFailed = logs.host.some((line) => /PUBLISH_FAILED/.test(line));
  const hostPrematureEnd = logs.host.some(
    (line) => /CALL_ENDED/.test(line) && !line.includes('source: local'),
  );
  const userConnected = await userPage
    .locator('button[aria-label="End call"]')
    .isVisible()
    .catch(() => false);
  const hostConnected = await hostPage
    .locator('button[aria-label="End call"]')
    .isVisible()
    .catch(() => false);

  const endBtn = hostPage.locator('button[aria-label="End call"]');
  if (await endBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await endBtn.click();
  } else {
    await api(`/calls/${initiated.callId}/end`, { method: 'POST', token: hostAuth.token });
  }

  const userLeftCall = await userPage
    .waitForURL((url) => !url.pathname.includes('/calls/'), { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const hostLeftCall = await hostPage
    .waitForURL((url) => !url.pathname.includes('/calls/'), { timeout: 25000 })
    .then(() => true)
    .catch(() => false);

  const userEndedLog = logs.user.some((line) => line.includes('CALL_ENDED'));
  const call = await api(`/calls/${initiated.callId}`, { token: userAuth.token });

  return {
    round,
    callId: initiated.callId,
    userConnected,
    hostConnected,
    userAcceptedLog,
    userJoinLog,
    hostJoinLog,
    userConnectedLog,
    hostLoginSuccess,
    hostRoomConnected,
    hostPublishSuccess,
    hostPublishFailed,
    hostPrematureEnd,
    userEndedLog,
    userLeftCall,
    hostLeftCall,
    callStatus: call.status,
    hasFreshZegoToken: Boolean(call.zego?.token?.startsWith('04')),
    userLogs: [...logs.user],
    hostLogs: [...logs.host],
    passed:
      userAcceptedLog &&
      userConnected &&
      hostConnected &&
      userJoinLog &&
      hostJoinLog &&
      hostLoginSuccess &&
      hostRoomConnected &&
      hostPublishSuccess &&
      !hostPublishFailed &&
      !hostPrematureEnd &&
      userEndedLog &&
      userLeftCall &&
      hostLeftCall &&
      call.status === 'ended' &&
      call.zego?.token?.startsWith('04'),
  };
}

const logs = { user: [], host: [] };

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const userContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
const hostContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
const userPage = await userContext.newPage();
const hostPage = await hostContext.newPage();
attachConsole(userPage, logs.user);
attachConsole(hostPage, logs.host);

const userAuth = await devLogin('user');
await new Promise((r) => setTimeout(r, 2000));
const hostAuth = await devLogin('host');

await loginPage(hostPage, 'host', hostAuth.session);
await loginPage(userPage, 'user', userAuth.session);
const hosts = await api('/hosts/discover?limit=5', { token: userAuth.token });
const hostId = hosts.hosts?.[0]?.userId ?? hostAuth.userId;

const call1 = await runCallRound({
  round: 1,
  userPage,
  hostPage,
  userAuth,
  hostAuth,
  hostId,
  logs,
});

await new Promise((r) => setTimeout(r, 5000));

const call2 = await runCallRound({
  round: 2,
  userPage,
  hostPage,
  userAuth,
  hostAuth,
  hostId,
  logs,
});

await browser.close();

const result = {
  call1,
  call2,
  passed: call1.passed && call2.passed,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.passed ? 0 : 1);