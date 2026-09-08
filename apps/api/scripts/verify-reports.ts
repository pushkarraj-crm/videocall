/**
 * Verifies production report & moderation flows.
 */
import { verifyApi as api } from './lib/verify-api';

type ApiError = Error & { code?: string; statusCode?: number };

async function createOrReuseReport(
  token: string,
  body: { reportedId: string; category: string; description: string },
) {
  try {
    return await api('/reports', { method: 'POST', token, body });
  } catch (err) {
    const e = err as ApiError;
    if (e.code !== 'DUPLICATE_REPORT') throw err;
    const mine = await api('/reports/me', { token });
    const existing = mine.items.find(
      (r: { reportedUserId: string; displayStatus: string }) =>
        r.reportedUserId === body.reportedId &&
        !['RESOLVED', 'REJECTED', 'DISMISSED'].includes(r.displayStatus),
    );
    if (!existing) throw err;
    return existing;
  }
}

async function main() {
  const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  const userToken = userSession.accessToken as string;
  const hostToken = hostSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;
  const hostId = hostSession.user.id as string;
  const userId = userSession.user.id as string;

  const userReport = await createOrReuseReport(userToken, {
    reportedId: hostId,
    category: 'harassment',
    description: 'Verify report from user',
  });
  if (!userReport.id) throw new Error('User report not created');
  if (!['OPEN', 'UNDER_REVIEW'].includes(userReport.displayStatus)) {
    throw new Error(`Unexpected user report status: ${userReport.displayStatus}`);
  }

  try {
    await api('/reports', {
      method: 'POST',
      token: userToken,
      body: {
        reportedId: hostId,
        category: 'spam',
        description: 'Duplicate attempt',
      },
    });
    throw new Error('Duplicate report should be blocked');
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code !== 'DUPLICATE_REPORT') throw err;
  }

  const hostReport = await createOrReuseReport(hostToken, {
    reportedId: userId,
    category: 'spam',
    description: 'Verify report from host',
  });
  if (!hostReport.id) throw new Error('Host report not created');

  const myReports = await api('/reports/me', { token: userToken });
  if (!myReports.items.some((r: { id: string }) => r.id === userReport.id)) {
    throw new Error('GET /reports/me missing user report');
  }

  const adminList = await api('/admin/reports?status=open&sort=newest', { token: adminToken });
  if (!adminList.items.length) throw new Error('Admin reports list empty');

  const detail = await api(`/admin/reports/${userReport.id}`, { token: adminToken });
  if (!detail.report) throw new Error('Admin report detail missing');

  let reviewed = userReport;
  if (userReport.displayStatus === 'OPEN') {
    reviewed = await api(`/admin/reports/${userReport.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: { action: 'under_review', adminNote: 'Reviewing verify script report' },
    });
    if (reviewed.displayStatus !== 'UNDER_REVIEW') throw new Error('Under review failed');
  }

  const resolved = await api(`/admin/reports/${hostReport.id}`, {
    method: 'PATCH',
    token: adminToken,
    body: { action: 'reject', resolution: 'No violation found' },
  });
  if (resolved.displayStatus !== 'REJECTED') throw new Error('Reject failed');

  console.log(
    JSON.stringify(
      {
        passed: true,
        userReportId: userReport.id,
        hostReportId: hostReport.id,
        riskLevel: detail.report.riskLevel,
        adminListCount: adminList.items.length,
        checks: [
          'user_report',
          'host_report',
          'duplicate_blocked',
          'reports_me',
          'admin_list',
          'admin_detail',
          'under_review',
          'reject',
        ],
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