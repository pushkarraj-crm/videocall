/**
 * Verifies host ONLINE / OFFLINE / BUSY availability layer.
 */
import { PrismaClient } from '@prisma/client';

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
  const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const userToken = userSession.accessToken as string;
  const hostToken = hostSession.accessToken as string;
  const hostId = hostSession.user.id as string;

  await prisma.hostProfile.upsert({
    where: { userId: hostId },
    create: { userId: hostId, isOnline: false, isBusy: false, isAvailable: false },
    update: { isOnline: false, isBusy: false, isAvailable: false, lastSeenAt: null },
  });

  await api('/hosts/status', { method: 'PATCH', token: hostToken, body: { status: 'ONLINE' } });
  await api('/hosts/heartbeat', { method: 'POST', token: hostToken });
  let discover = await api('/hosts/discover?limit=50', { token: userToken });
  if (!discover.hosts.some((h: { userId: string }) => h.userId === hostId)) {
    throw new Error('Online host not visible in discover');
  }

  await api('/hosts/status', { method: 'PATCH', token: hostToken, body: { status: 'OFFLINE' } });
  const offlineProfile = await prisma.hostProfile.findUniqueOrThrow({ where: { userId: hostId } });
  if (!offlineProfile.lastSeenAt) {
    throw new Error('lastSeenAt not updated on offline');
  }
  discover = await api('/hosts/discover?limit=50', { token: userToken });
  if (discover.hosts.some((h: { userId: string }) => h.userId === hostId)) {
    throw new Error('Offline host still visible in discover');
  }

  try {
    await api('/calls/initiate', {
      method: 'POST',
      token: userToken,
      body: { calleeId: hostId },
    });
    throw new Error('Call to offline host should fail');
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (!message.toLowerCase().includes('offline')) {
      throw err;
    }
  }

  await api('/hosts/status', { method: 'PATCH', token: hostToken, body: { status: 'ONLINE' } });
  await api('/hosts/heartbeat', { method: 'POST', token: hostToken });
  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isBusy: true, isAvailable: false },
  });

  discover = await api('/hosts/discover?limit=50', { token: userToken });
  const busyHost = discover.hosts.find((h: { userId: string }) => h.userId === hostId);
  if (!busyHost?.isBusy) {
    throw new Error('Busy host not marked busy in discover');
  }

  try {
    await api('/calls/initiate', {
      method: 'POST',
      token: userToken,
      body: { calleeId: hostId },
    });
    throw new Error('Call to busy host should fail');
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (!message.toLowerCase().includes('another call')) {
      throw err;
    }
  }

  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isBusy: false, isAvailable: true },
  });

  const status = await api('/hosts/status', { token: hostToken });
  if (status.status !== 'ONLINE' || status.isBusy) {
    throw new Error('Host not restored to ONLINE after busy cleared');
  }

  console.log(JSON.stringify({ passed: true, hostId, status }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());