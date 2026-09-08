/**
 * Verifies AI Voice Streaming Engine: start, stream, interrupt, cache, analytics.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
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
        data: {
          virtualHostStatus: 'ONLINE',
          isOnline: true,
          isBusy: false,
          isAvailable: true,
        },
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

async function consumeVoiceStream(
  token: string,
  streamId: string,
): Promise<{ firstChunkMs: number | null; chunkCount: number }> {
  const base = process.env.VERIFY_API_BASE ?? 'http://localhost:3001/v1';
  const res = await fetch(`${base}/virtual-hosts/voice/stream/${streamId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) throw new Error(`Voice stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let firstChunkMs: number | null = null;
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const raw = JSON.parse(dataLine.slice(5).trim()) as {
        data?: {
          type: string;
          audio?: string;
          firstChunkMs?: number | null;
          chunkCount?: number;
        };
        type?: string;
        audio?: string;
        firstChunkMs?: number | null;
        chunkCount?: number;
      };
      const json = raw.data ?? raw;
      if (json.type === 'chunk' && json.audio) chunkCount++;
      if (json.type === 'done') {
        firstChunkMs = json.firstChunkMs ?? null;
        chunkCount = json.chunkCount ?? chunkCount;
      }
    }
  }

  return { firstChunkMs, chunkCount };
}

async function main() {
  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const virtual = await findVirtualHost();
  await resetHost(virtual.userId);

  const voices = await api('/virtual-hosts/voice/voices', { token: user.accessToken });
  if (!voices.providers?.length) throw new Error('Voice catalog empty');

  await api(`/admin/virtual-hosts/${virtual.userId}/voice`, {
    method: 'PATCH',
    token: admin.accessToken,
    body: {
      voiceProvider: 'local',
      voiceId: 'warm_female_1',
      language: 'en',
      speed: 1,
      pitch: 1,
      emotion: 'friendly',
    },
  });

  const testPreview = await api('/admin/virtual-hosts/voice/test', {
    method: 'POST',
    token: admin.accessToken,
    body: { hostId: virtual.userId, text: 'Hello, this is a voice preview test.' },
  });
  if (!testPreview.audio || testPreview.latencyMs > 5000) {
    throw new Error('Admin voice test failed SLA');
  }

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

  const greeting = await api(`/virtual-hosts/conversation/${initiated.callId}/event`, {
    method: 'POST',
    token: user.accessToken,
    body: { eventType: 'greeting' },
  });
  if (!greeting.text) throw new Error('Greeting text missing');

  const started = await api('/virtual-hosts/voice/start', {
    method: 'POST',
    token: user.accessToken,
    body: { callId: initiated.callId, text: greeting.text, eventType: 'greeting' },
  });
  if (!started.streamId) throw new Error('Voice start missing streamId');

  const stream1 = await consumeVoiceStream(user.accessToken, started.streamId);
  if (stream1.chunkCount < 1) throw new Error('No audio chunks received');
  if (stream1.firstChunkMs != null && stream1.firstChunkMs > 5000) {
    throw new Error(`First chunk too slow: ${stream1.firstChunkMs}ms`);
  }

  const started2 = await api('/virtual-hosts/voice/start', {
    method: 'POST',
    token: user.accessToken,
    body: { callId: initiated.callId, text: greeting.text, eventType: 'greeting' },
  });
  const stream2 = await consumeVoiceStream(user.accessToken, started2.streamId);
  if (stream2.chunkCount < 1) throw new Error('Cache replay failed');

  const interruptStart = await api('/virtual-hosts/voice/start', {
    method: 'POST',
    token: user.accessToken,
    body: {
      callId: initiated.callId,
      text: 'This is a longer message that should be interrupted before playback completes entirely.',
      eventType: 'message',
    },
  });
  await api('/virtual-hosts/voice/interrupt', {
    method: 'POST',
    token: user.accessToken,
    body: { callId: initiated.callId, streamId: interruptStart.streamId },
  });

  await api(`/calls/${initiated.callId}/end`, { method: 'POST', token: user.accessToken });

  const sessions = await prisma.virtualHostVoiceSession.count({
    where: { callId: initiated.callId },
  });
  if (sessions < 2) throw new Error('Voice session audit missing');

  const analytics = await api('/admin/virtual-hosts/voice/analytics', {
    token: admin.accessToken,
  });
  if (analytics.totalVoiceSessions < 1) throw new Error('Voice analytics empty');

  await api('/admin/virtual-hosts/voice/analytics?hostId=' + virtual.userId, {
    token: admin.accessToken,
  });

  // Regression
  await api('/hosts/discover?page=1&limit=50', { token: user.accessToken });

  console.log('✓ verify-ai-voice passed');
  console.log(`  First chunk: ${stream1.firstChunkMs ?? 'n/a'}ms`);
  console.log(`  Chunks: ${stream1.chunkCount}`);
  console.log(`  Admin preview: ${testPreview.latencyMs}ms (${testPreview.provider})`);
  console.log(`  Sessions audited: ${sessions}`);
  console.log(`  Avg first chunk: ${analytics.averageFirstChunkMs}ms`);
}

main()
  .catch((e) => {
    console.error('✗ verify-ai-voice failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());