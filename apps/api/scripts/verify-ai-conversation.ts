/**
 * Verifies AI Conversation Engine: greeting, memory, streaming, events, analytics.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function findVirtualHost() {
  const profile = await prisma.hostProfile.findFirst({
    where: { profileType: 'AI_HOST', virtualHostEnabled: true, virtualHostStatus: 'ONLINE' },
    include: { user: true },
    orderBy: { virtualHostPriority: 'desc' },
  });
  if (!profile) throw new Error('No virtual host');
  return profile;
}

async function resetHost(hostId: string) {
  await prisma.call.updateMany({
    where: { calleeId: hostId, status: { in: [CallStatus.initiated, CallStatus.active] } },
    data: { status: CallStatus.ended, endedAt: new Date() },
  });
  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isBusy: false, isOnline: true, isAvailable: true, virtualHostStatus: 'ONLINE' },
  });
}

async function main() {
  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const virtual = await findVirtualHost();
  await resetHost(virtual.userId);

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: user.accessToken,
    body: { calleeId: virtual.userId },
  });

  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: user.accessToken,
    body: { documentVersion: '1.0' },
  });

  const ctx = await api(`/virtual-hosts/conversation/${initiated.callId}/context`, {
    token: user.accessToken,
  });
  if (!ctx.sessionId) throw new Error('Context preload failed');
  if (!ctx.systemPromptCached) throw new Error('Prompt cache flag missing');

  const greeting = await api(`/virtual-hosts/conversation/${initiated.callId}/event`, {
    method: 'POST',
    token: user.accessToken,
    body: { eventType: 'greeting' },
  });
  if (!greeting.text || greeting.responseMs > 5000) throw new Error('Greeting too slow or empty');

  const reply = await api(`/virtual-hosts/conversation/${initiated.callId}/message`, {
    method: 'POST',
    token: user.accessToken,
    body: { message: 'Hey! How are you today?', clientTurnId: `verify:${Date.now()}` },
  });
  if (!reply.text || reply.responseMs > 5000) throw new Error('Message response failed SLA');
  if (!reply.emotion) throw new Error('Emotion missing');

  const giftEvt = await api(`/virtual-hosts/conversation/${initiated.callId}/event`, {
    method: 'POST',
    token: user.accessToken,
    body: { eventType: 'gift_received', giftName: 'rose' },
  });
  if (!giftEvt.text) throw new Error('Gift event reply missing');

  const history = await api(`/virtual-hosts/conversation/${initiated.callId}/history`, {
    token: user.accessToken,
  });
  if ((history.turns?.length ?? 0) < 3) throw new Error('History too short');

  const memory = await api(`/virtual-hosts/memory/${virtual.userId}`, { token: user.accessToken });
  if (!memory.conversationHistory?.length && !memory.lastCallSummary) {
    throw new Error('Memory not updated');
  }

  await api(`/calls/${initiated.callId}/end`, { method: 'POST', token: user.accessToken });

  const turns = await prisma.virtualHostConversationTurn.count({
    where: { callId: initiated.callId },
  });
  if (turns < 3) throw new Error('Audit turns missing');

  const convAnalytics = await api('/admin/virtual-hosts/conversation/analytics', {
    token: admin.accessToken,
  });
  if (convAnalytics.totalAssistantTurns < 1) throw new Error('Conversation analytics empty');

  await api('/admin/virtual-hosts/conversation/analytics?hostId=' + virtual.userId, {
    token: admin.accessToken,
  });

  await api(`/admin/virtual-hosts/${virtual.userId}/conversation`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: { temperature: 0.8, safetyLevel: 'moderate', defaultEmotion: 'happy' },
  });

  // Regression: virtual hosts verify still works
  const discover = await api('/hosts/discover?page=1&limit=50', { token: user.accessToken });
  if (!discover.hosts?.some((h: { userId: string }) => h.userId === virtual.userId)) {
    throw new Error('Discover regression');
  }

  console.log('✓ verify-ai-conversation passed');
  console.log(`  Greeting: ${greeting.responseMs}ms`);
  console.log(`  Reply: ${reply.responseMs}ms — ${reply.emotion}`);
  console.log(`  Turns audited: ${turns}`);
  console.log(`  Avg response: ${convAnalytics.averageResponseMs}ms`);
}

main()
  .catch((e) => {
    console.error('✗ verify-ai-conversation failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());