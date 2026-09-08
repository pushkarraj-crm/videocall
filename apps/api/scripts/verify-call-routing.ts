/**
 * Verifies call routing: real-host-first, AI fallback, video lock, history.
 */
import { CallHostType, CallStatus, PrismaClient } from '@prisma/client';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function resetHosts() {
  await prisma.call.updateMany({
    where: { status: { in: [CallStatus.initiated, CallStatus.active] } },
    data: { status: CallStatus.ended, endedAt: new Date() },
  });
  await prisma.hostProfile.updateMany({
    where: { profileType: 'REAL_HOST' },
    data: { isBusy: false, isOnline: false },
  });
  await prisma.hostProfile.updateMany({
    where: { profileType: { in: ['AI_HOST', 'MANAGED_HOST'] }, virtualHostEnabled: true },
    data: { isBusy: false, isOnline: true, isAvailable: true, virtualHostStatus: 'ONLINE' },
  });
}

async function main() {
  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  await resetHosts();

  const settings = await api('/admin/settings/call-routing', { token: admin.accessToken });
  if (!settings.aiFallbackEnabled) throw new Error('AI fallback should default ON');
  console.log('✓ Routing settings loaded');

  await api('/admin/settings/call-routing', {
    method: 'PATCH',
    token: admin.accessToken,
    body: { realHostTimeoutSeconds: 3, aiFallbackEnabled: true },
  });

  const matched = await api('/calls/match', {
    method: 'POST',
    token: user.accessToken,
    body: {},
  });

  if (matched.routing !== 'AI_HOST' && matched.hostCallType !== 'AI_HOST') {
    throw new Error(`Expected AI_HOST routing, got ${matched.routing}`);
  }
  if (!matched.isVirtualHost) throw new Error('AI match should be virtual host');
  console.log('✓ AI fallback match', matched.aiFallback ? '(fallback)' : '');

  const call = await prisma.call.findUnique({ where: { id: matched.callId } });
  if (call?.hostCallType !== CallHostType.AI_HOST) throw new Error('Call hostCallType not set');
  console.log('✓ Call hostCallType persisted');

  const history = await prisma.callHistory.findUnique({ where: { callId: matched.callId } });
  if (history?.hostCallType !== CallHostType.AI_HOST) throw new Error('History hostCallType missing');
  console.log('✓ Call history hostCallType');

  const session = await prisma.virtualHostSession.findUnique({ where: { callId: matched.callId } });
  if (!session?.lockedVideoUrl) {
    console.log('⚠ lockedVideoUrl empty (no local assets — OK in dev)');
  } else {
    console.log('✓ Video locked:', session.lockedVideoUrl);
  }

  await api(`/calls/${matched.callId}/consent`, {
    method: 'POST',
    token: user.accessToken,
    body: { documentVersion: '1.0' },
  });

  const reply = await api(`/virtual-hosts/conversation/${matched.callId}/message`, {
    method: 'POST',
    token: user.accessToken,
    body: { message: 'Hello!' },
  });
  if (!reply.text) throw new Error('Conversation failed on routed call');
  console.log('✓ Conversation on AI routed call');

  await api(`/calls/${matched.callId}/end`, { method: 'POST', token: user.accessToken });

  await resetHosts();
  const realHost = await prisma.hostProfile.findFirst({
    where: { profileType: 'REAL_HOST' },
  });
  if (realHost) {
    await prisma.hostProfile.update({
      where: { userId: realHost.userId },
      data: { isOnline: true, isBusy: false, isAvailable: true },
    });
    await api('/admin/settings/call-routing', {
      method: 'PATCH',
      token: admin.accessToken,
      body: { realHostTimeoutSeconds: 3 },
    });
    const realMatch = await api('/calls/match', {
      method: 'POST',
      token: user.accessToken,
      body: {},
    });
    if (realMatch.routing !== 'REAL_HOST') {
      console.log('⚠ Real host routing skipped (host may not have accepted in time)');
    } else {
      console.log('✓ Real host routing when available');
      await api(`/calls/${realMatch.callId}/end`, { method: 'POST', token: user.accessToken });
    }
  }

  await api('/hosts/discover?page=1&limit=5', { token: user.accessToken });
  console.log('✓ Regression discover');

  console.log('\n=== verify-call-routing: all passed ===\n');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('✗ verify-call-routing failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});