/**
 * Verifies Operations Panel payments endpoint.
 */
import { verifyApi as api } from './lib/verify-api';

async function main() {
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const token = admin.accessToken as string;

  const all = await api('/admin/operations/payments?page=1&limit=10', { token });
  if (!Array.isArray(all.items)) throw new Error('payments.items missing');
  if (!Array.isArray(all.summary)) throw new Error('payments.summary missing');

  const paid = await api('/admin/operations/payments?status=paid&limit=5', { token });
  for (const item of paid.items as Array<{ status: string }>) {
    if (item.status !== 'paid') throw new Error('paid filter returned non-paid item');
  }

  const csv = await fetch(`${process.env.API_URL ?? 'http://localhost:3001/v1'}/admin/operations/reports/export?report=payments&period=30d`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.text());

  if (!csv.includes('payment_id')) throw new Error('payments export header missing');

  console.log(
    JSON.stringify(
      {
        passed: true,
        total: all.total,
        summaryStatuses: (all.summary as Array<{ status: string }>).map((s) => s.status),
        exportLines: csv.split('\n').length,
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