/**
 * Verifies AI Host Memory: extraction, persistence, greeting, recall.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
import {
  buildGreeting,
  buildMemorySummary,
  extractFactsFromMessage,
} from '../src/common/utils/memory-engine';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function findVirtualHost() {
  const profile = await prisma.hostProfile.findFirst({
    where: { profileType: 'AI_HOST', virtualHostEnabled: true },
    include: { user: true },
  });
  if (!profile) throw new Error('No virtual host');
  return profile;
}

async function main() {
  const facts = extractFactsFromMessage('My favorite color is black and I live in Delhi');
  if (facts.favoriteColor !== 'black' || facts.city !== 'Delhi') {
    throw new Error('Fact extraction failed');
  }
  console.log('✓ Fact extraction');

  const greeting0 = buildGreeting({ userName: 'Raj', callCount: 0, language: 'en' });
  const greeting1 = buildGreeting({ userName: 'Raj', callCount: 1, language: 'en' });
  if (!greeting0.includes('Nice to meet') || !greeting1.includes('Welcome back')) {
    throw new Error('Greeting tiers failed');
  }
  console.log('✓ Greeting tiers');

  const summary = buildMemorySummary({ nickname: 'Raj', favoriteColor: 'black' });
  if (!summary.includes('black')) throw new Error('Memory summary failed');
  console.log('✓ Memory summary');

  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const host = await findVirtualHost();

  await prisma.call.updateMany({
    where: { calleeId: host.userId, status: { in: [CallStatus.initiated, CallStatus.active] } },
    data: { status: CallStatus.ended, endedAt: new Date() },
  });
  await prisma.hostProfile.update({
    where: { userId: host.userId },
    data: { isBusy: false, isOnline: true, isAvailable: true, virtualHostStatus: 'ONLINE' },
  });

  await prisma.aIHostMemory.deleteMany({ where: { userId: user.user.id, hostId: host.userId } });
  await prisma.conversationHistory.deleteMany({ where: { userId: user.user.id, hostId: host.userId } });

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

  await api(`/virtual-hosts/conversation/${initiated.callId}/message`, {
    method: 'POST',
    token: user.accessToken,
    body: { message: 'My favorite color is black. Call me Raj.' },
  });

  const memory = await prisma.aIHostMemory.findUnique({
    where: { hostId_userId: { hostId: host.userId, userId: user.user.id } },
  });
  if (!memory?.favoriteColor?.toLowerCase().includes('black')) {
    throw new Error(`Memory not saved: ${memory?.favoriteColor}`);
  }
  console.log('✓ Memory saving');

  const history = await prisma.conversationHistory.findFirst({
    where: { hostId: host.userId, userId: user.user.id },
  });
  if (!history?.userMessage) throw new Error('Conversation history missing');
  console.log('✓ Conversation history row');

  const adminList = await api('/admin/virtual-hosts/memory?limit=5', { token: admin.accessToken });
  if (!adminList.items?.length) throw new Error('Admin memory list empty');
  console.log('✓ Admin memory list');

  await api(`/admin/virtual-hosts/memory/${host.userId}/${user.user.id}`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: { notes: 'Verified by script' },
  });
  console.log('✓ Admin memory edit');

  await api(`/admin/virtual-hosts/memory/${host.userId}/${user.user.id}`, {
    method: 'DELETE',
    token: admin.accessToken,
  });
  console.log('✓ Admin memory delete');

  console.log('\n=== verify-memory: all passed ===\n');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});