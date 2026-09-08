/**
 * Verifies relationship score growth and tiers.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
import {
  clampRelationshipScore,
  getRelationshipTier,
  relationshipScoreDelta,
} from '../src/common/utils/relationship-engine';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function main() {
  const tier = getRelationshipTier(25);
  if (tier.label !== 'Friend') throw new Error('Tier at 25 should be Friend');
  console.log('✓ Relationship tiers');

  const delta = relationshipScoreDelta('gift') + relationshipScoreDelta('message', { messageLength: 50 });
  if (delta <= 0) throw new Error('Positive events should grow score');
  console.log('✓ Score deltas');

  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const host = await prisma.hostProfile.findFirst({
    where: { profileType: 'AI_HOST', virtualHostEnabled: true },
    include: { user: true },
  });
  if (!host) throw new Error('No host');

  await prisma.call.updateMany({
    where: { calleeId: host.userId, status: { in: [CallStatus.initiated, CallStatus.active] } },
    data: { status: CallStatus.ended, endedAt: new Date() },
  });
  await prisma.hostProfile.update({
    where: { userId: host.userId },
    data: { isBusy: false, isOnline: true, isAvailable: true, virtualHostStatus: 'ONLINE' },
  });

  await prisma.aIHostMemory.deleteMany({ where: { userId: user.user.id, hostId: host.userId } });

  await prisma.aIHostMemory.create({
    data: { userId: user.user.id, hostId: host.userId, relationshipScore: 15, callCount: 0 },
  });

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: user.accessToken,
    body: { calleeId: host.userId },
  });
  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: user.accessToken,
    body: { documentVersion: '1.0' },
  });

  const before = await prisma.aIHostMemory.findUnique({
    where: { hostId_userId: { hostId: host.userId, userId: user.user.id } },
  });

  await api(`/virtual-hosts/conversation/${initiated.callId}/message`, {
    method: 'POST',
    token: user.accessToken,
    body: { message: 'You are amazing, thanks for chatting with me today!' },
  });

  await api(`/virtual-hosts/conversation/${initiated.callId}/event`, {
    method: 'POST',
    token: user.accessToken,
    body: { eventType: 'gift_received', giftName: 'rose' },
  });

  await api(`/virtual-hosts/conversation/${initiated.callId}/event`, {
    method: 'POST',
    token: user.accessToken,
    body: { eventType: 'call_ending' },
  });

  const after = await prisma.aIHostMemory.findUnique({
    where: { hostId_userId: { hostId: host.userId, userId: user.user.id } },
  });

  if ((after?.relationshipScore ?? 0) <= (before?.relationshipScore ?? 0)) {
    throw new Error('Relationship score did not grow');
  }
  if ((after?.callCount ?? 0) !== 1) {
    throw new Error(`Expected callCount 1, got ${after?.callCount}`);
  }
  console.log('✓ Relationship growth on call');

  const ctx = await api(`/virtual-hosts/conversation/${initiated.callId}/context`, {
    token: user.accessToken,
  }).catch(() => null);
  if (ctx?.relationship?.tier) console.log('✓ Relationship in context');

  const clamped = clampRelationshipScore(9999);
  if (clamped !== 1000) throw new Error('Clamp failed');

  console.log('\n=== verify-relationship: all passed ===\n');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});