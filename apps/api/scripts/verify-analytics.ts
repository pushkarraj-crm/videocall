/**
 * Verifies admin analytics dashboard, filters, and CSV export.
 */
const API = process.env.API_URL ?? 'http://localhost:3001/v1';

async function api(path: string, opts: { method?: string; token?: string } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? 'GET',
    headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : {},
  });
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/csv')) {
    const text = await res.text();
    if (!res.ok) throw new Error(`CSV export failed (${res.status})`);
    return text;
  }
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `API ${path} failed (${res.status})`);
  }
  return json.data;
}

async function main() {
  const adminSession = await fetch(`${API}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin' }),
  }).then((r) => r.json());

  const token = adminSession.data.accessToken as string;

  const dashboard = await api('/admin/analytics/dashboard?period=30d', { token });
  if (typeof dashboard.revenue.totalInr !== 'number') {
    throw new Error('Dashboard missing revenue.totalInr');
  }
  if (!Array.isArray(dashboard.trend)) {
    throw new Error('Dashboard missing trend array');
  }
  if (dashboard.trend.length < 1) {
    throw new Error('Trend should have at least one day');
  }

  const filtered = await api('/admin/analytics/dashboard?period=7d', { token });
  if (filtered.period.key !== '7d') {
    throw new Error('7d filter not applied');
  }

  const revenueCsv = (await api('/admin/analytics/export?type=revenue&period=7d', {
    token,
  })) as string;
  if (!revenueCsv.startsWith('date,revenue_inr')) {
    throw new Error('Revenue CSV header missing');
  }

  const hostsCsv = (await api('/admin/analytics/export?type=hosts&period=30d', {
    token,
  })) as string;
  if (!hostsCsv.startsWith('host_name,calls')) {
    throw new Error('Hosts CSV header missing');
  }

  const withdrawalsCsv = (await api('/admin/analytics/export?type=withdrawals&period=90d', {
    token,
  })) as string;
  if (!withdrawalsCsv.startsWith('date,host')) {
    throw new Error('Withdrawals CSV header missing');
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        totalRevenueInr: dashboard.revenue.totalInr,
        trendDays: dashboard.trend.length,
        topHosts: dashboard.topHosts.length,
        topUsers: dashboard.topUsers.length,
        csvLines: {
          revenue: revenueCsv.split('\n').length,
          hosts: hostsCsv.split('\n').length,
          withdrawals: withdrawalsCsv.split('\n').length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});