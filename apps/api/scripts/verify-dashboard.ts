/**
 * Verifies enterprise Operations Panel overview endpoint.
 */
import { verifyApi as api } from './lib/verify-api';

async function main() {
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const token = admin.accessToken as string;

  const overview = await api('/admin/operations/overview?period=30d', { token });

  const required = [
    'revenue',
    'live',
    'hosts',
    'charts',
    'fraud',
    'alerts',
    'payments',
    'withdrawals',
  ] as const;

  for (const key of required) {
    if (!overview[key]) throw new Error(`Missing overview.${key}`);
  }

  if (typeof overview.revenue.totalInr !== 'number') throw new Error('revenue.totalInr missing');
  if (typeof overview.live.activeCalls !== 'number') throw new Error('live.activeCalls missing');
  if (!Array.isArray(overview.charts.revenue)) throw new Error('charts.revenue missing');
  if (!Array.isArray(overview.topAiHosts)) throw new Error('topAiHosts missing');
  if (!Array.isArray(overview.topRealHosts)) throw new Error('topRealHosts missing');

  const liveCalls = await api('/admin/operations/live-calls?limit=5', { token });
  if (!Array.isArray(liveCalls)) throw new Error('live-calls should return array');

  const hosts = await api('/admin/operations/hosts?page=1&limit=5', { token });
  if (!Array.isArray(hosts.items)) throw new Error('hosts.items missing');

  console.log(
    JSON.stringify(
      {
        passed: true,
        totalRevenueInr: overview.revenue.totalInr,
        activeCalls: overview.live.activeCalls,
        onlineUsers: overview.live.onlineUsers,
        fraudFlags: overview.fraud.openFlags,
        alerts: overview.alerts.length,
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