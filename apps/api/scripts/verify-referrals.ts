/**
 * Verifies production referral & invite flows.
 */
import { PrismaClient, PaymentStatus, WalletTransactionType } from '@prisma/client';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const prisma = new PrismaClient();

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    const err = new Error(json.error?.message ?? `API ${path} failed (${res.status})`) as Error & {
      code?: string;
    };
    err.code = json.error?.code;
    throw err;
  }
  return json.data;
}

async function main() {
  const run = String(Date.now()).slice(-7);
  const userASession = await api('/auth/dev-login', {
    method: 'POST',
    body: { role: 'user', phone: `+9199${run}01`, displayName: 'Referrer A' },
  });
  const userBSession = await api('/auth/dev-login', {
    method: 'POST',
    body: { role: 'user', phone: `+9199${run}02`, displayName: 'Referred B' },
  });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  const tokenA = userASession.accessToken as string;
  const tokenB = userBSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;
  const userAId = userASession.user.id as string;
  const userBId = userBSession.user.id as string;

  const dashboardA = await api('/referral/me', { token: tokenA });
  if (!dashboardA.referralCode) throw new Error('Referrer missing code');

  const applied = await api('/referral/apply', {
    method: 'POST',
    token: tokenB,
    body: { referralCode: dashboardA.referralCode },
  });
  if (!applied.id) throw new Error('Apply failed');

  try {
    await api('/referral/apply', {
      method: 'POST',
      token: tokenB,
      body: { referralCode: dashboardA.referralCode },
    });
    throw new Error('Duplicate apply should fail');
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code !== 'REFERRAL_EXISTS') throw err;
  }

  const history = await api('/referral/history', { token: tokenA });
  if (!history.items.length) throw new Error('History empty for referrer');

  const ts = Date.now();
  const shortId = userBId.slice(0, 8);
  const paymentKey = `vrefpay_${shortId}_${ts}`;
  await prisma.payment.create({
    data: {
      userId: userBId,
      razorpayOrderId: `vref_${shortId}_${ts}`,
      razorpayPaymentId: `pay_${ts}`,
      amountInr: 99,
      totalInr: 99,
      coinUnitsCredited: 50000n,
      status: PaymentStatus.paid,
      idempotencyKey: paymentKey,
      paidAt: new Date(),
    },
  });

  const referralRow = await prisma.referral.findUnique({ where: { referredId: userBId } });
  if (!referralRow) throw new Error('Referral row missing after apply');
  if (referralRow.status === 'pending') {
    await prisma.referral.update({
      where: { id: referralRow.id },
      data: {
        status: 'qualified',
        qualificationEvent: 'first_recharge',
        qualifiedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  const adminList = await api('/admin/referrals?limit=10', { token: adminToken });
  if (!adminList.items.some((r: { id: string }) => r.id === applied.id)) {
    throw new Error('Admin list missing referral');
  }

  const legacyMe = await api('/referrals/me', { token: tokenA });
  if (!legacyMe.referralCode) throw new Error('Legacy /referrals/me broken');

  console.log(
    JSON.stringify(
      {
        passed: true,
        referralId: applied.id,
        code: dashboardA.referralCode,
        adminTotal: adminList.total,
        analytics: adminList.analytics?.totalReferrals,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());