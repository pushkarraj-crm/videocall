/**
 * Verifies host personality prompts and in-character replies.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
import { buildPersonalityPrompt, resolveHostTraits } from '../src/common/utils/personality-engine';
import { generateLocalReply } from '../src/common/utils/conversation-engine';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function main() {
  const traits = resolveHostTraits('Sophia');
  if (!traits.includes('Flirty') || !traits.includes('Caring')) {
    throw new Error('Sophia traits missing');
  }
  console.log('✓ Personality traits');

  const prompt = buildPersonalityPrompt('Sophia', 'hinglish', { romanticLevel: 0.7 });
  if (!prompt.includes('NEVER break character')) throw new Error('Prompt missing character rule');
  console.log('✓ Personality prompt');

  const reply = generateLocalReply(
    {
      now: new Date().toISOString(),
      hostName: 'Sophia',
      userName: 'Dev',
      language: 'hinglish',
      personality: { style: 'Romantic', flirtingLevel: 'medium', emojiUsage: 'medium' },
      conversation: { personalityTraits: traits, romanticLevel: 0.7 },
      memory: { callCount: 0, relationshipScore: 0 },
      callDurationSeconds: 30,
      giftsReceived: 0,
    },
    'tell me something cute',
  );
  if (!reply.text || reply.text.length < 5) throw new Error('Personality reply empty');
  console.log('✓ In-character local reply');

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

  const ctx = await api(`/virtual-hosts/conversation/${initiated.callId}/context`, {
    token: user.accessToken,
  });
  if (!ctx.personality) throw new Error('Context personality missing');
  console.log('✓ Live conversation context personality');

  console.log('\n=== verify-personality: all passed ===\n');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});