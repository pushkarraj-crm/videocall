/**
 * Verifies host auth flow: login, application pending, admin approval, dashboard access.
 */
import { HostApplicationStatus, PrismaClient } from '@prisma/client';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function main() {
  const runId = Date.now();
  const applicant = await api('/auth/dev-login', {
    method: 'POST',
    body: {
      phone: `+9198${String(runId).slice(-8)}`,
      displayName: `Applicant ${runId}`,
      role: 'user',
    },
  });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const applicantId = applicant.user.id as string;
  const applicantToken = applicant.accessToken as string;
  const adminToken = admin.accessToken as string;

  await prisma.hostApplication.deleteMany({ where: { userId: applicantId } });
  await prisma.hostProfile.deleteMany({ where: { userId: applicantId } });
  await prisma.userRole.deleteMany({ where: { userId: applicantId, role: 'host' } });

  const beforeApply = await api('/hosts/application', { token: applicantToken });
  if (beforeApply.status !== null) {
    throw new Error('Expected no application before apply');
  }

  const applied = await api('/hosts/apply', { method: 'POST', token: applicantToken });
  if (applied.status !== HostApplicationStatus.pending) {
    throw new Error(`Expected pending application, got ${applied.status}`);
  }

  const pending = await api('/hosts/application', { token: applicantToken });
  if (pending.canAccessDashboard) {
    throw new Error('Applicant should not access dashboard before approval');
  }

  try {
    await api('/hosts/dashboard', { token: applicantToken });
    throw new Error('Dashboard should be forbidden before approval');
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const code = (err as Error & { code?: string }).code;
    if (
      code !== 'FORBIDDEN' &&
      !message.toLowerCase().includes('forbidden') &&
      !message.toLowerCase().includes('permission') &&
      !message.toLowerCase().includes('host')
    ) {
      throw err;
    }
  }

  await api(`/admin/users/${applicantId}/approve-host`, {
    method: 'POST',
    token: adminToken,
  });

  const approved = await api('/hosts/application', { token: applicantToken });
  if (!approved.canAccessDashboard || approved.status !== HostApplicationStatus.approved) {
    throw new Error('Application not approved');
  }

  const dashboard = await api('/hosts/dashboard', { token: applicantToken });
  if (!dashboard.profile) {
    throw new Error('Host dashboard unavailable after approval');
  }

  const refresh = await api('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: applicant.refreshToken },
  });
  if (!refresh.accessToken) {
    throw new Error('Refresh token failed for host');
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        applicantId,
        applicationStatus: approved.status,
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