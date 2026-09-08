/**
 * Verifies AI Video Avatar Engine: config, wardrobe, sync, performance, regression.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
import {
  cameraFraming,
  defaultVideoAvatarConfig,
  defaultWardrobeConfig,
  phonemeFromEnergy,
  resolvePose,
} from '../src/common/utils/video-avatar-engine';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function findVirtualHost() {
  let profile = await prisma.hostProfile.findFirst({
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

function benchPoseResolver(n = 1000) {
  const start = performance.now();
  for (let i = 0; i < n; i++) {
    resolvePose(i % 2 === 0, i % 3 === 0, i % 5 === 0 ? 'wave' : null, 'happy');
    phonemeFromEnergy(i, 0.5, 'hello world');
    cameraFraming('auto', { speaking: i % 2 === 0, autoZoom: true });
  }
  return performance.now() - start;
}

async function main() {
  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const virtual = await findVirtualHost();
  await resetHost(virtual.userId);

  const benchMs = benchPoseResolver();
  if (benchMs > 80) throw new Error(`Video engine too slow: ${benchMs}ms`);

  const catalog = await api('/virtual-hosts/video-avatar/catalog', { token: user.accessToken });
  if (!catalog.poses?.length) throw new Error('Video catalog empty');

  await api(`/admin/virtual-hosts/${virtual.userId}/video`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: { ...defaultVideoAvatarConfig(), cameraMode: 'auto', lipSyncMode: 'phoneme' },
  });

  const outfitId = 'verify_outfit_casual';
  await api(`/admin/virtual-hosts/${virtual.userId}/wardrobe`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: {
      activeOutfitId: outfitId,
      outfits: [
        {
          id: outfitId,
          name: 'Verify Casual',
          category: 'casual',
          imageUrl: virtual.user.avatarUrl,
          approved: true,
        },
      ],
    },
  });

  await api(`/admin/virtual-hosts/${virtual.userId}/wardrobe/${outfitId}/activate`, {
    method: 'POST',
    token: admin.accessToken,
  });

  const preview = await api('/admin/virtual-hosts/video-avatar/preview', {
    method: 'POST',
    token: admin.accessToken,
    body: { hostId: virtual.userId, cameraMode: 'medium' },
  });
  if (preview.performance?.targetFps !== 60) throw new Error('Performance spec missing');

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: user.accessToken,
    body: { calleeId: virtual.userId },
  });

  const call = await api(`/calls/${initiated.callId}`, { token: user.accessToken });
  if (!call.virtualHost?.video?.enabled) throw new Error('Video config missing from call meta');
  if (!call.virtualHost?.wardrobe?.outfits?.length) throw new Error('Wardrobe missing');

  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: user.accessToken,
    body: { documentVersion: '1.0' },
  });

  const greeting = await api(`/virtual-hosts/conversation/${initiated.callId}/event`, {
    method: 'POST',
    token: user.accessToken,
    body: { eventType: 'greeting' },
  });
  if (!greeting.text) throw new Error('Conversation sync failed');

  const voice = await api('/virtual-hosts/voice/start', {
    method: 'POST',
    token: user.accessToken,
    body: { callId: initiated.callId, text: greeting.text, eventType: 'greeting' },
  });
  if (!voice.streamId) throw new Error('Voice sync failed');

  await api(`/calls/${initiated.callId}/end`, { method: 'POST', token: user.accessToken });

  // Regression — core modules untouched
  await api('/hosts/discover?page=1&limit=5', { token: user.accessToken });

  const memBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < 200; i++) defaultWardrobeConfig();
  const memDelta = process.memoryUsage().heapUsed - memBefore;
  if (memDelta > 5_000_000) throw new Error(`Memory spike: ${memDelta} bytes`);

  console.log('✓ verify-video-avatar passed');
  console.log(`  Engine bench: ${benchMs.toFixed(2)}ms / 1000 ops`);
  console.log(`  Video enabled: ${call.virtualHost.video.enabled}`);
  console.log(`  Active outfit: ${call.virtualHost.wardrobe.activeOutfitId}`);
  console.log(`  Poses: ${catalog.poses.length}`);
  console.log(`  Memory delta: ${(memDelta / 1024).toFixed(1)}KB`);
}

main()
  .catch((e) => {
    console.error('✗ verify-video-avatar failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());