/**
 * Verifies production promo codes & campaign flows.
 */
const API = process.env.API_URL ?? 'http://localhost:3001/v1';

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
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const adminToken = adminSession.accessToken as string;

  const run = String(Date.now()).slice(-6);
  const code = `TEST${run}`;

  const created = await api('/admin/promotions', {
    method: 'POST',
    token: adminToken,
    body: {
      code,
      title: 'Verify Welcome 20%',
      campaignType: 'welcome',
      discountType: 'percentage',
      discountValue: 20,
      maxDiscount: 50,
      minimumRecharge: 0,
      bonusCoins: 25,
      usageLimit: 500,
      usagePerUser: 1,
      visibility: 'public',
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  const userSession = await api('/auth/dev-login', {
    method: 'POST',
    body: { role: 'user', phone: `+9198${run}01`, displayName: 'Promo User' },
  });
  const userToken = userSession.accessToken as string;

  const packages = await api('/payments/packages');
  if (!packages.length) throw new Error('No packages for promo test');
  const pkg = packages[0];

  const available = await api(`/promotions/available?packageId=${pkg.id}`, { token: userToken });
  if (!available.coupons.some((c: { code: string }) => c.code === code)) {
    throw new Error('Created coupon not in available list');
  }

  const applied = await api('/promotions/apply', {
    method: 'POST',
    token: userToken,
    body: { code, packageId: pkg.id },
  });
  if (!applied.preview?.finalInr) throw new Error('Apply preview missing');

  const history = await api('/promotions/history', { token: userToken });

  const adminList = await api('/admin/promotions?search=' + code, { token: adminToken });
  if (!adminList.items.some((p: { id: string }) => p.id === created.id)) {
    throw new Error('Admin list missing promo');
  }

  const analytics = await api('/admin/promotions/analytics', { token: adminToken });
  if (analytics.totalCoupons < 1) throw new Error('Analytics missing coupons');

  await api('/promotions/remove', { method: 'POST', token: userToken });

  const legacyOrder = await api('/payments/create-order', {
    method: 'POST',
    token: userToken,
    body: { packageId: pkg.id },
  });
  if (!legacyOrder.razorpayOrderId) throw new Error('Legacy create-order broken');

  console.log(
    JSON.stringify(
      {
        passed: true,
        promoId: created.id,
        code,
        previewFinalInr: applied.preview.finalInr,
        availableCount: available.coupons.length,
        historyTotal: history.total,
        adminTotal: adminList.total,
        analyticsCoupons: analytics.totalCoupons,
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
  });