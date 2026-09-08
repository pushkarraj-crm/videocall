/**
 * Verifies production anti-fraud & risk detection: engine, flags, freezes, admin APIs.
 */
import { PrismaClient, RiskEventType } from '@prisma/client';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const INTERNAL_KEY =
  process.env.COMMUNICATIONS_INTERNAL_API_KEY ?? 'dev-internal-communications-key';

const prisma = new PrismaClient();

async function api(
  path: string,
  opts: {
    method?: string;
    token?: string;
    body?: unknown;
    internal?: boolean;
    expectError?: boolean;
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
  if (opts.expectError) {
    if (res.ok && json.success) throw new Error(`Expected error for ${path}`);
    return json;
  }
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `API ${path} failed (${res.status})`);
  }
  return json.data;
}

async function main() {
  const run = String(Date.now()).slice(-7);
  const userSession = await api('/auth/dev-login', {
    method: 'POST',
    body: { role: 'user', phone: `+9199${run}91`, displayName: 'Risk Test User' },
  });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  const userToken = userSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;
  const userId = userSession.user.id as string;

  const fingerprint = await api('/risk/fingerprint', {
    method: 'POST',
    token: userToken,
    body: {
      fingerprint: `fp_${run}`,
      platform: 'web',
      os: 'macOS',
      timezone: 'Asia/Kolkata',
      language: 'en',
      resolution: '1920x1080',
      browser: 'Chrome',
      country: 'IN',
    },
  });
  if (!fingerprint.registered) throw new Error('Fingerprint registration failed');

  const evalResult = await api('/internal/risk/evaluate', {
    method: 'POST',
    internal: true,
    body: {
      userId,
      eventType: RiskEventType.signup,
      ip: '203.0.113.50',
      fingerprint: `fp_${run}`,
      country: 'IN',
      metadata: { referenceId: `verify-signup-${userId}` },
    },
  });
  if (typeof evalResult.score !== 'number') throw new Error('Risk evaluation missing score');

  const dashboard = await api('/admin/risk', { token: adminToken });
  if (typeof dashboard.highRiskAccounts !== 'number') throw new Error('Dashboard missing counts');

  const analytics = await api('/admin/risk/analytics', { token: adminToken });
  if (typeof analytics.dailyFraudAttempts !== 'number') throw new Error('Analytics missing');

  const events = await api('/admin/risk/events', { token: adminToken });
  if (!Array.isArray(events.items)) throw new Error('Events list missing');

  const profiles = await api('/admin/risk/profiles', { token: adminToken });
  if (!Array.isArray(profiles.items)) throw new Error('Profiles list missing');

  const detail = await api(`/admin/risk/${userId}`, { token: adminToken });
  if (!detail.user?.id) throw new Error('Profile detail missing user');

  await api(`/admin/risk/${userId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { freezeReferralRewards: true, adminNote: 'Verify script freeze test' },
  });

  const restrictions = await prisma.riskUserProfile.findUnique({ where: { userId } });
  if (!restrictions?.freezeReferralRewards) throw new Error('Freeze referral rewards not applied');

  const refErr = await api('/referral/apply', {
    method: 'POST',
    token: userToken,
    body: { referralCode: 'TESTCODE' },
    expectError: true,
  });
  if (refErr.error?.code !== 'RISK_FROZEN') {
    throw new Error(`Expected RISK_FROZEN, got ${refErr.error?.code}`);
  }

  await api(`/admin/risk/${userId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { markSafe: true },
  });

  const cleared = await prisma.riskUserProfile.findUnique({ where: { userId } });
  if (cleared && cleared.freezeReferralRewards) throw new Error('Mark safe did not clear freeze');

  const auditCount = await prisma.riskDecisionAudit.count({ where: { userId } });
  if (auditCount < 1) throw new Error('Audit log missing');

  console.log('✓ Risk fingerprint registration');
  console.log('✓ Internal risk evaluation');
  console.log('✓ Admin dashboard, analytics, events, profiles');
  console.log('✓ Profile detail & admin actions');
  console.log('✓ Referral reward freeze enforcement');
  console.log('✓ Mark safe clears restrictions');
  console.log('✓ Audit logs recorded');
  console.log('\nAll risk verification checks passed.');
}

main()
  .catch((e) => {
    console.error('Risk verification failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());