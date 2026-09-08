/**
 * Verifies premium gift catalog, send, history, leaderboard.
 */
import { CallStatus, PrismaClient } from '@prisma/client';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function main() {
  const user = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const host = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });

  await prisma.call.updateMany({
    where: {
      calleeId: host.user.id,
      status: { in: [CallStatus.initiated, CallStatus.active] },
    },
    data: { status: CallStatus.ended, endedAt: new Date() },
  });
  await prisma.hostProfile.update({
    where: { userId: host.user.id },
    data: { isBusy: false, isOnline: true, isAvailable: true },
  });
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  const catalog = await api('/gifts/catalog', { token: user.accessToken });
  if (!catalog.items?.length) throw new Error('Catalog empty');
  const rose = catalog.items.find((g: { slug: string }) => g.slug === 'rose');
  if (!rose) throw new Error('Rose not in catalog');

  try {
    await api('/hosts/status', {
      method: 'PATCH',
      token: host.accessToken,
      body: { status: 'ONLINE' },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code !== 'HOST_BUSY') throw err;
  }

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: user.accessToken,
    body: { calleeId: host.user.id },
  });

  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: user.accessToken,
    body: { documentVersion: '1.0' },
  });
  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: host.accessToken,
    body: { documentVersion: '1.0' },
  });
  await api(`/calls/${initiated.callId}/accept`, { method: 'POST', token: host.accessToken });

  const sent = await api(`/calls/${initiated.callId}/gifts`, {
    method: 'POST',
    token: user.accessToken,
    body: { giftId: 'rose', quantity: 2, idempotencyKey: `verify:gift:${Date.now()}` },
  });
  if (!sent.gift?.giftId) throw new Error('Gift send response missing gift');
  if (sent.combo?.quantity !== 2) throw new Error('Combo quantity mismatch');

  const feed = await api(`/gifts/calls/${initiated.callId}/feed`, { token: host.accessToken });
  if (!feed.gifts?.length) throw new Error('Call feed empty');

  const history = await api('/gifts/history', { token: user.accessToken });
  if (!history.items?.length) throw new Error('User gift history empty');

  const stats = await api('/gifts/stats/me', { token: user.accessToken });
  if (stats.totalGiftsSent < 1) throw new Error('User stats wrong');

  const hostStats = await api('/gifts/stats/host', { token: host.accessToken });
  if (hostStats.todayGifts < 1) throw new Error('Host stats wrong');

  const board = await api('/gifts/leaderboard?period=weekly');
  if (!board.topGifters?.length) throw new Error('Leaderboard empty');

  const adminList = await api('/admin/gifts', { token: admin.accessToken });
  if (adminList.length < 10) throw new Error('Admin gift list too short');

  const analytics = await api('/admin/gifts/analytics', { token: admin.accessToken });
  if (analytics.totalGiftsSent < 1) throw new Error('Admin analytics wrong');

  await api(`/calls/${initiated.callId}/end`, { method: 'POST', token: user.accessToken });

  console.log(
    JSON.stringify(
      {
        passed: true,
        catalogCount: catalog.items.length,
        sentGift: sent.gift.giftId,
        balanceAfter: sent.balanceCoins,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());