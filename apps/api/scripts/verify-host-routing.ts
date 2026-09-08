/**
 * Verifies real-host routing with heartbeat + accept-timeout → AI fallback.
 */
import { CallHostType, CallStatus, PrismaClient } from '@prisma/client';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const host = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const hostId = host.user.id as string;

  await prisma.call.updateMany({
    where: { status: { in: [CallStatus.initiated, CallStatus.active] } },
    data: { status: CallStatus.ended, endedAt: new Date() },
  });

  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isOnline: false, isBusy: false, isAvailable: false, profileType: 'REAL_HOST' },
  });
  await prisma.hostHeartbeat.deleteMany({ where: { userId: hostId } });

  await api('/admin/settings/call-routing', {
    method: 'PATCH',
    token: admin.accessToken,
    body: { realHostTimeoutSeconds: 3, aiFallbackEnabled: true },
  });

  const noHeartbeatMatch = await api('/calls/match', {
    method: 'POST',
    token: user.accessToken,
    body: {},
  });
  if (noHeartbeatMatch.routing !== 'AI_HOST') {
    throw new Error('Expected AI fallback when no online host with heartbeat');
  }

  await api('/hosts/status', {
    method: 'PATCH',
    token: host.accessToken,
    body: { status: 'ONLINE' },
  });
  await api('/hosts/heartbeat', { method: 'POST', token: host.accessToken });

  const realMatch = await api('/calls/match', {
    method: 'POST',
    token: user.accessToken,
    body: {},
  });

  if (realMatch.routing !== 'REAL_HOST') {
    throw new Error(`Expected REAL_HOST when host online, got ${realMatch.routing}`);
  }
  console.log('✓ Real host matched immediately (caller can consent while host rings)');

  await sleep(4000);

  const timedOutCall = await prisma.call.findUnique({ where: { id: realMatch.callId } });
  if (timedOutCall?.status !== CallStatus.ended) {
    throw new Error(`Expected real call ended after timeout, got ${timedOutCall?.status}`);
  }
  console.log('✓ Real host call ended after timeout (no accept)');

  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isOnline: false, isBusy: false, isAvailable: false },
  });

  const aiMatch = await api('/calls/match', {
    method: 'POST',
    token: user.accessToken,
    body: {},
  });
  if (aiMatch.routing !== 'AI_HOST') {
    throw new Error(`Expected AI_HOST when no real host available, got ${aiMatch.routing}`);
  }
  console.log('✓ AI routing when real host unavailable after timeout');

  const call = await prisma.call.findFirst({
    where: { callerId: user.user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!call) throw new Error('No call persisted');

  const settings = await api('/admin/settings/call-routing', { token: admin.accessToken });
  if (settings.realHostTimeoutSeconds < 20) {
    console.log(`⚠ realHostTimeoutSeconds=${settings.realHostTimeoutSeconds} (migration may be pending)`);
  }

  if (call.hostCallType === CallHostType.REAL_HOST) {
    console.log('✓ Real host call type persisted');
  } else if (call.hostCallType === CallHostType.AI_HOST) {
    console.log('✓ AI host call type persisted (fallback path)');
  }

  await prisma.call.updateMany({
    where: { status: { in: [CallStatus.initiated, CallStatus.active] } },
    data: { status: CallStatus.ended, endedAt: new Date() },
  });
  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isOnline: true, isBusy: false, isAvailable: true },
  });
  await api('/hosts/heartbeat', { method: 'POST', token: host.accessToken });

  const acceptMatch = await api('/calls/match', {
    method: 'POST',
    token: user.accessToken,
    body: {},
  });
  if (acceptMatch.routing !== 'REAL_HOST') {
    throw new Error('Expected REAL_HOST for accept regression');
  }

  await api(`/calls/${acceptMatch.callId}/consent`, {
    method: 'POST',
    token: user.accessToken,
    body: { documentVersion: '1.0' },
  });
  await api(`/calls/${acceptMatch.callId}/consent`, {
    method: 'POST',
    token: host.accessToken,
    body: { documentVersion: '1.0' },
  });

  const accepted = await api(`/calls/${acceptMatch.callId}/accept`, {
    method: 'POST',
    token: host.accessToken,
  });
  if (accepted.call.status !== 'active') {
    throw new Error(`Expected active after accept, got ${accepted.call.status}`);
  }

  const activeCall = await prisma.call.findUnique({ where: { id: acceptMatch.callId } });
  if (activeCall?.status !== CallStatus.active) {
    throw new Error('Real call must stay active after host accept');
  }
  if (activeCall.hostCallType !== CallHostType.REAL_HOST) {
    throw new Error('hostCallType must remain REAL_HOST after accept');
  }

  const aiCallsAfterAccept = await prisma.call.count({
    where: {
      callerId: user.user.id,
      hostCallType: CallHostType.AI_HOST,
      createdAt: { gt: activeCall.createdAt },
    },
  });
  if (aiCallsAfterAccept > 0) {
    throw new Error('AI routing must not run after HOST_ACCEPTED');
  }
  console.log('✓ Real host accept cancels AI fallback (no second AI call)');

  await api(`/calls/${acceptMatch.callId}/end`, { method: 'POST', token: user.accessToken });

  console.log('\n=== verify-host-routing: all passed ===\n');
}

main()
  .catch((err) => {
    console.error('✗ verify-host-routing failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());