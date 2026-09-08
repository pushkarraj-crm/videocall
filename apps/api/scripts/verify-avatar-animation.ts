/**
 * Verifies AI Avatar Animation Engine: config, catalog, emotion/gift mappings, regression.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
import {
  mapCallEventToReaction,
  mapEmotionToExpression,
  mapGiftToReaction,
  pickIdleAnimation,
  defaultAvatarAnimationConfig,
} from '../src/common/utils/avatar-engine';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function findVirtualHost() {
  let profile = await prisma.hostProfile.findFirst({
    where: { profileType: 'AI_HOST', virtualHostEnabled: true, virtualHostStatus: 'ONLINE' },
    include: { user: true },
    orderBy: { virtualHostPriority: 'desc' },
  });
  if (!profile) {
    profile = await prisma.hostProfile.findFirst({
      where: { profileType: 'AI_HOST', virtualHostEnabled: true },
      include: { user: true },
      orderBy: { virtualHostPriority: 'desc' },
    });
    if (profile) {
      await prisma.hostProfile.update({
        where: { userId: profile.userId },
        data: { virtualHostStatus: 'ONLINE', isOnline: true, isBusy: false, isAvailable: true },
      });
    }
  }
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

function benchIdlePicker(iterations = 500): number {
  const config = defaultAvatarAnimationConfig();
  const start = performance.now();
  const played: Record<string, number> = {};
  let last: string | null = null;
  for (let i = 0; i < iterations; i++) {
    const pick = pickIdleAnimation(config, last, played, Date.now() + i * 100);
    played[pick.id] = Date.now() + i * 100;
    last = pick.id;
  }
  return performance.now() - start;
}

async function main() {
  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const virtual = await findVirtualHost();
  await resetHost(virtual.userId);

  // Engine unit checks
  const happy = mapEmotionToExpression('happy', 0.8);
  if (!happy.mouthCurve || happy.id !== 'happy') throw new Error('Emotion mapping failed');

  const vipGift = mapGiftToReaction('vip');
  if (vipGift.id !== 'celebrate_stand') throw new Error('VIP gift reaction wrong');

  const silence = mapCallEventToReaction('long_silence');
  if (silence?.id !== 'look_around') throw new Error('Call event mapping failed');

  const pickerMs = benchIdlePicker();
  if (pickerMs > 50) throw new Error(`Idle picker too slow: ${pickerMs}ms`);

  const catalog = await api('/virtual-hosts/avatar/catalog', { token: user.accessToken });
  if (!catalog.idleAnimations?.length) throw new Error('Avatar catalog empty');

  await api(`/admin/virtual-hosts/${virtual.userId}/avatar`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: {
      defaultIdleAnimation: 'breathe',
      expressionIntensity: 0.8,
      blinkFrequency: 'medium',
      headMovement: 'normal',
      reactionsEnabled: true,
      lipSyncIntensity: 0.75,
    },
  });

  const preview = await api('/admin/virtual-hosts/avatar/preview', {
    method: 'POST',
    token: admin.accessToken,
    body: { hostId: virtual.userId, expressionIntensity: 0.9 },
  });
  if (preview.performance?.targetFps !== 60) throw new Error('Preview performance spec missing');

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: user.accessToken,
    body: { calleeId: virtual.userId },
  });

  const callDetail = await api(`/calls/${initiated.callId}`, { token: user.accessToken });
  const vhMeta = callDetail.virtualHost;
  if (!vhMeta?.avatar?.defaultIdleAnimation) throw new Error('Avatar config not in call meta');

  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: user.accessToken,
    body: { documentVersion: '1.0' },
  });

  await api(`/virtual-hosts/conversation/${initiated.callId}/event`, {
    method: 'POST',
    token: user.accessToken,
    body: { eventType: 'greeting' },
  });

  const greetingVoice = await api('/virtual-hosts/voice/start', {
    method: 'POST',
    token: user.accessToken,
    body: { callId: initiated.callId, text: 'Hello!', eventType: 'greeting' },
  });
  if (!greetingVoice.streamId) throw new Error('Voice regression failed');

  await api(`/calls/${initiated.callId}/end`, { method: 'POST', token: user.accessToken });

  // Regression scripts
  await api('/hosts/discover?page=1&limit=50', { token: user.accessToken });

  console.log('✓ verify-avatar-animation passed');
  console.log(`  Emotions: ${Object.keys(catalog.emotions ?? {}).length || catalog.emotions?.length} mapped`);
  console.log(`  Idle picker: ${pickerMs.toFixed(2)}ms / 500 picks`);
  console.log(`  Avatar config: ${vhMeta.avatar.defaultIdleAnimation}`);
  console.log(`  Performance: ${preview.performance.rendering}, ${preview.performance.targetFps}fps target`);
}

main()
  .catch((e) => {
    console.error('✗ verify-avatar-animation failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());