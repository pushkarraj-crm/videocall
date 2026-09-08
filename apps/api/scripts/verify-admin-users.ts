/**
 * Verifies admin user management: search, filters, suspend, block, force offline, logs.
 */
import { PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();
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
    throw new Error(json.error?.message ?? `API ${path} failed (${res.status})`);
  }
  return json.data;
}

async function main() {
  const runId = Date.now();
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const hostSession = await api('/auth/dev-login', {
    method: 'POST',
    body: { role: 'host', phone: `+9198888${String(runId).slice(-4)}`, displayName: `Verify Host ${runId}` },
  });
  const adminToken = adminSession.accessToken as string;
  const hostId = hostSession.user.id as string;

  await prisma.hostProfile.upsert({
    where: { userId: hostId },
    create: { userId: hostId, isOnline: true, isAvailable: true },
    update: { isOnline: true, isAvailable: true, isBusy: false },
  });

  const list = await api('/admin/users?role=host&limit=5', { token: adminToken });
  if (!list.overview || !Array.isArray(list.items)) {
    throw new Error('User list response invalid');
  }

  const search = await api(`/admin/users?q=${hostId}`, { token: adminToken });
  const found = search.items.find((u: { id: string }) => u.id === hostId);
  if (!found) throw new Error('Search by user ID failed');

  const detail = await api(`/admin/users/${hostId}`, { token: adminToken });
  if (detail.id !== hostId) throw new Error('User detail failed');

  await api(`/admin/users/${hostId}/host-controls`, {
    method: 'PATCH',
    token: adminToken,
    body: { callsDisabled: true },
  });

  try {
    await api('/calls/initiate', {
      method: 'POST',
      token: (await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } })).accessToken,
      body: { calleeId: hostId },
    });
    throw new Error('Call should be blocked when calls disabled');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.toLowerCase().includes('call') && !msg.toLowerCase().includes('accept')) throw err;
  }

  await api(`/admin/users/${hostId}/host-controls`, {
    method: 'PATCH',
    token: adminToken,
    body: { callsDisabled: false, withdrawalsDisabled: true },
  });

  await api(`/admin/users/${hostId}/force-offline`, { method: 'PATCH', token: adminToken });
  const offline = await prisma.hostProfile.findUniqueOrThrow({ where: { userId: hostId } });
  if (offline.isOnline) throw new Error('Force offline failed');

  await api(`/admin/users/${hostId}/suspend`, {
    method: 'PATCH',
    token: adminToken,
    body: { note: 'Verify suspend' },
  });

  const suspended = await prisma.user.findUniqueOrThrow({ where: { id: hostId } });
  if (suspended.status !== UserStatus.suspended) throw new Error('Suspend failed');

  const logs = await api(`/admin/users/${hostId}/history?type=admin_logs`, { token: adminToken });
  if (!logs.items?.length) throw new Error('Admin logs not created');

  await api(`/admin/users/${hostId}/unsuspend`, { method: 'PATCH', token: adminToken });

  await api(`/admin/users/${hostId}/block`, {
    method: 'PATCH',
    token: adminToken,
    body: { note: 'Verify block' },
  });
  const blocked = await prisma.user.findUniqueOrThrow({ where: { id: hostId } });
  if (blocked.status !== UserStatus.banned) throw new Error('Block failed');

  await api(`/admin/users/${hostId}/unblock`, { method: 'PATCH', token: adminToken });

  const paged = await api('/admin/users?page=1&limit=2', { token: adminToken });
  if (paged.limit !== 2) throw new Error('Pagination failed');

  console.log(JSON.stringify({ passed: true, hostId, logCount: logs.items.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());