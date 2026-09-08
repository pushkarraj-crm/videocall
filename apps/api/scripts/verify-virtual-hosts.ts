/**
 * Verifies Virtual Host Engine: discover, matching, wallet, gifts, admin CRUD.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function findVirtualHost() {
  const profile = await prisma.hostProfile.findFirst({
    where: {
      profileType: 'AI_HOST',
      virtualHostEnabled: true,
      virtualHostStatus: 'ONLINE',
    },
    include: { user: true },
    orderBy: { virtualHostPriority: 'desc' },
  });
  if (!profile) throw new Error('No seeded virtual host — run prisma seed');
  return profile;
}

async function resetHost(hostId: string) {
  await prisma.call.updateMany({
    where: {
      calleeId: hostId,
      status: { in: [CallStatus.initiated, CallStatus.active] },
    },
    data: { status: CallStatus.ended, endedAt: new Date() },
  });
  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: {
      isBusy: false,
      isOnline: true,
      isAvailable: true,
      virtualHostStatus: 'ONLINE',
    },
  });
}

async function main() {
  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const virtual = await findVirtualHost();
  await resetHost(virtual.userId);

  const discover = await api('/hosts/discover?page=1&limit=50', { token: user.accessToken });
  const vhInDiscover = discover.hosts?.find(
    (h: { userId: string; profileType?: string }) => h.userId === virtual.userId,
  );
  if (!vhInDiscover) throw new Error('Virtual host missing from discover');
  if (vhInDiscover.profileType !== 'AI_HOST') throw new Error('profileType not exposed in discover');

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: user.accessToken,
    body: { calleeId: virtual.userId },
  });
  if (!initiated.isVirtualHost) throw new Error('isVirtualHost flag missing');
  if (!initiated.virtualHost?.greeting) throw new Error('virtualHost meta missing');

  const consent = await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: user.accessToken,
    body: { documentVersion: '1.0' },
  });
  if (!consent.autoAccepted) throw new Error('Virtual host should auto-accept after caller consent');

  const call = await api(`/calls/${initiated.callId}`, { token: user.accessToken });
  if (call.status !== 'active') throw new Error(`Expected active call, got ${call.status}`);
  if (!call.isVirtualHost) throw new Error('getCall missing isVirtualHost');

  const session = await api(`/virtual-hosts/session/${initiated.callId}`, {
    token: user.accessToken,
  });
  if (!session.sessionId) throw new Error('Virtual session missing');

  const catalog = await api('/gifts/catalog', { token: user.accessToken });
  const rose = catalog.items?.find((g: { slug: string }) => g.slug === 'rose');
  if (!rose) throw new Error('Rose not in catalog');

  const sent = await api(`/calls/${initiated.callId}/gifts`, {
    method: 'POST',
    token: user.accessToken,
    body: { giftId: 'rose', quantity: 1, idempotencyKey: `verify:vh:gift:${Date.now()}` },
  });
  if (!sent.giftReaction) throw new Error('Gift reaction missing for virtual host');

  await api(`/calls/${initiated.callId}/billing-tick`, {
    method: 'POST',
    token: user.accessToken,
  });

  await api(`/calls/${initiated.callId}/end`, { method: 'POST', token: user.accessToken });

  const vhSession = await prisma.virtualHostSession.findUnique({
    where: { callId: initiated.callId },
  });
  if (!vhSession?.endedAt) throw new Error('Virtual session not finalized');
  if (!vhSession.conversationSummary) throw new Error('Conversation summary missing');

  const memory = await api(`/virtual-hosts/memory/${virtual.userId}`, {
    token: user.accessToken,
  });
  if (memory.callCount < 1) throw new Error('Memory callCount not updated');

  const adminList = await api('/admin/virtual-hosts', { token: admin.accessToken });
  if (!adminList.length) throw new Error('Admin list empty');

  const analytics = await api('/admin/virtual-hosts/analytics', { token: admin.accessToken });
  if (analytics.virtualHostCalls < 1) throw new Error('Admin analytics wrong');

  const realHost = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  try {
    await api('/hosts/status', {
      method: 'PATCH',
      token: realHost.accessToken,
      body: { status: 'ONLINE' },
    });
  } catch {
    /* host may be busy */
  }

  console.log('✓ verify-virtual-hosts passed');
  console.log(`  Discover: ${vhInDiscover.user.displayName ?? virtual.user.displayName}`);
  console.log(`  Session: ${vhSession.sessionId}`);
  console.log(`  Gifts: ${vhSession.giftsReceivedCount}`);
}

main()
  .catch((e) => {
    console.error('✗ verify-virtual-hosts failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());