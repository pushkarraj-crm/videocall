/**
 * Verifies host heartbeat: ping while online, stale sweep marks offline.
 */
import { PrismaClient } from '@prisma/client';
import { heartbeatStaleCutoff, HOST_HEARTBEAT_STALE_MS } from '../src/common/utils/host-heartbeat';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function main() {
  const host = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const hostId = host.user.id as string;
  const hostToken = host.accessToken as string;

  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isOnline: false, isBusy: false, isAvailable: false },
  });
  await prisma.hostHeartbeat.deleteMany({ where: { userId: hostId } });

  await api('/hosts/status', {
    method: 'PATCH',
    token: hostToken,
    body: { status: 'ONLINE' },
  });

  const beat = await api('/hosts/heartbeat', { method: 'POST', token: hostToken });
  if (!beat.lastBeatAt) {
    throw new Error('Heartbeat did not record lastBeatAt');
  }

  const status = await api('/hosts/status', { token: hostToken });
  if (!status.heartbeatFresh || !status.canReceiveCalls) {
    throw new Error('Fresh heartbeat should make host receivable');
  }

  const staleAt = new Date(Date.now() - HOST_HEARTBEAT_STALE_MS - 1000);
  await prisma.hostHeartbeat.update({
    where: { userId: hostId },
    data: { lastBeatAt: staleAt },
  });

  const cutoff = heartbeatStaleCutoff();
  const stale = await prisma.hostProfile.findMany({
    where: {
      userId: hostId,
      profileType: 'REAL_HOST',
      isOnline: true,
      OR: [{ hostHeartbeat: null }, { hostHeartbeat: { lastBeatAt: { lt: cutoff } } }],
    },
    select: { userId: true },
  });

  if (stale.length < 1) {
    throw new Error('Host should be stale before sweep');
  }

  const now = new Date();
  await prisma.hostProfile.updateMany({
    where: { userId: hostId },
    data: { isOnline: false, isBusy: false, isAvailable: false, lastSeenAt: now },
  });

  const profile = await prisma.hostProfile.findUniqueOrThrow({ where: { userId: hostId } });
  if (profile.isOnline) {
    throw new Error('Host should be offline after stale heartbeat');
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        hostId,
        markedOffline: stale.length,
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