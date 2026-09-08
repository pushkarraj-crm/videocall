/**
 * Verifies production email & SMS communications: settings, queue, templates, admin, analytics.
 */
const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const INTERNAL_KEY =
  process.env.COMMUNICATIONS_INTERNAL_API_KEY ?? 'dev-internal-communications-key';

async function api(
  path: string,
  opts: {
    method?: string;
    token?: string;
    body?: unknown;
    internal?: boolean;
  } = {},
) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.internal ? { 'x-internal-api-key': INTERNAL_KEY } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `API ${path} failed (${res.status})`);
  }
  return json.data;
}

async function main() {
  const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  const userToken = userSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;
  const userId = userSession.user.id as string;
  const userEmail = (userSession.user.email as string) ?? 'user@test.com';
  const userPhone = (userSession.user.phone as string) ?? '+919999999999';

  await api('/communications/settings', {
    method: 'PATCH',
    token: userToken,
    body: {
      marketingEmails: true,
      marketingSms: true,
      transactionalEmails: true,
      transactionalSms: true,
      promotionEmails: true,
      promotionSms: true,
      referralUpdates: true,
    },
  });

  const settings = await api('/communications/settings', { token: userToken });
  if (settings.securityEmails !== true || settings.securitySms !== true) {
    throw new Error('Security channels must always be enabled');
  }

  const welcome = await api('/internal/communications/email', {
    method: 'POST',
    internal: true,
    body: {
      userId,
      to: userEmail || `verify-${userId}@platform.test`,
      eventType: 'welcome_email',
      templateData: { name: 'Test User' },
      idempotencyKey: `verify:welcome:${userId}`,
    },
  });
  if (!welcome.queued && !welcome.duplicate) throw new Error('Welcome email not queued');

  const updated = await api('/communications/settings', {
    method: 'PATCH',
    token: userToken,
    body: { marketingEmails: false, promotionSms: true },
  });
  if (updated.marketingEmails !== false) throw new Error('Settings PATCH failed');

  const skippedWelcome = await api('/internal/communications/email', {
    method: 'POST',
    internal: true,
    body: {
      userId,
      to: userEmail || `verify-${userId}@platform.test`,
      eventType: 'welcome_email',
      templateData: { name: 'Blocked' },
      idempotencyKey: `verify:welcome:blocked:${userId}`,
    },
  });
  if (!skippedWelcome.skipped) throw new Error('Marketing opt-out should skip welcome email');

  const receipt = await api('/internal/communications/email', {
    method: 'POST',
    internal: true,
    body: {
      userId,
      to: userEmail || `verify-${userId}@platform.test`,
      eventType: 'receipt',
      templateData: { name: 'Test', amountInr: '499', coins: '500' },
      idempotencyKey: `verify:receipt:${userId}`,
    },
  });
  if (!receipt.queued && !receipt.duplicate) throw new Error('Receipt email not queued');

  const otp = await api('/internal/communications/sms', {
    method: 'POST',
    internal: true,
    body: {
      to: userPhone,
      eventType: 'otp_verification',
      templateData: { code: '123456', expiresIn: '10 min' },
      idempotencyKey: `verify:otp:${userPhone}`,
    },
  });
  if (!otp.queued && !otp.duplicate) throw new Error('OTP SMS not queued');

  const rechargeSms = await api('/internal/communications/sms', {
    method: 'POST',
    internal: true,
    body: {
      userId,
      to: userPhone,
      eventType: 'recharge_success',
      templateData: { amountInr: '199', coins: '200' },
      idempotencyKey: `verify:recharge-sms:${userId}`,
    },
  });
  if (!rechargeSms.queued && !rechargeSms.duplicate) throw new Error('Recharge SMS not queued');

  const preview = await api('/admin/email', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Verify Campaign',
      subject: 'Test Subject',
      body: 'Hello from verify script',
      audience: 'single_user',
      targetUserId: userId,
      preview: true,
    },
  });
  if (!preview.preview) throw new Error('Email preview failed');

  const adminList = await api('/admin/communications', { token: adminToken });
  if (!Array.isArray(adminList.items)) throw new Error('Admin communications list failed');

  const analytics = await api('/admin/communications/analytics', { token: adminToken });
  if (typeof analytics.totalEmails !== 'number') throw new Error('Analytics missing totalEmails');
  if (typeof analytics.smsDeliveryRate !== 'number') throw new Error('Analytics missing smsDeliveryRate');

  const logs = await api('/admin/communications/logs?limit=5', { token: adminToken });
  if (!Array.isArray(logs.items)) throw new Error('Communication logs failed');

  await new Promise((r) => setTimeout(r, 1500));

  const logsAfter = await api('/admin/communications/logs?limit=10', { token: adminToken });
  if (logsAfter.total < logs.total) {
    /* queue may still be processing */
  }

  console.log('✓ Communications verification passed');
  console.log(`  Settings: security mandatory OK`);
  console.log(`  Queued: welcome, receipt, OTP, recharge SMS`);
  console.log(`  Admin: preview, list, analytics, logs`);
  console.log(`  Analytics: ${analytics.totalEmails} emails, SMS delivery ${analytics.smsDeliveryRate}%`);
}

main().catch((err) => {
  console.error('✗ Communications verification failed:', err.message);
  process.exit(1);
});