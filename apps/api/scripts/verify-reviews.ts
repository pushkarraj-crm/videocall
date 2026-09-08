/**
 * Verifies production host rating & review flows.
 */
import { PrismaClient, WalletTransactionType } from '@prisma/client';
import { BALANCE_AFFECTING_TX_TYPES } from '../src/modules/wallet/wallet-consistency';

import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function completeCall(userToken: string, hostToken: string, hostId: string) {
  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isOnline: true, isAvailable: true },
  });

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: userToken,
    body: { calleeId: hostId },
  });

  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: userToken,
    body: { documentVersion: '1.0' },
  });
  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: hostToken,
    body: { documentVersion: '1.0' },
  });
  await api(`/calls/${initiated.callId}/accept`, { method: 'POST', token: hostToken });

  await prisma.call.update({
    where: { id: initiated.callId },
    data: { startedAt: new Date(Date.now() - 30_000) },
  });

  await api(`/calls/${initiated.callId}/end`, {
    method: 'POST',
    token: userToken,
  });

  await new Promise((r) => setTimeout(r, 500));
  return initiated.callId as string;
}

async function ensureUserBalance(callerId: string) {
  const minUnits = 500000n;
  const topUpKey = `verify:reviews:topup:${callerId}`;
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: callerId },
      create: {
        userId: callerId,
        balanceUnits: 0n,
        lifetimeCreditedUnits: 0n,
        lifetimeDebitedUnits: 0n,
      },
      update: {},
    });
    const agg = await tx.walletTransaction.aggregate({
      where: { walletId: wallet.id, type: { in: BALANCE_AFFECTING_TX_TYPES } },
      _sum: { amountUnits: true },
    });
    const txSum = agg._sum.amountUnits ?? 0n;
    if (txSum >= minUnits) return;
    const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: topUpKey } });
    if (existing) return;
    const topUpUnits = minUnits - txSum;
    const newBalance = txSum + topUpUnits;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceUnits: newBalance,
        lifetimeCreditedUnits: wallet.lifetimeDebitedUnits + newBalance,
      },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: callerId,
        type: WalletTransactionType.payment_credit,
        amountUnits: topUpUnits,
        balanceAfterUnits: newBalance,
        idempotencyKey: topUpKey,
        description: 'Reviews verification top-up',
      },
    });
  });
  await prisma.user.update({
    where: { id: callerId },
    data: { freeCallsUsed: 5 },
  });
}

async function main() {
  const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });

  const userToken = userSession.accessToken as string;
  const hostToken = hostSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;
  const hostId = hostSession.user.id as string;
  const userId = userSession.user.id as string;

  await ensureUserBalance(userId);

  const callId = await completeCall(userToken, hostToken, hostId);

  const eligibility = await api(`/reviews/eligibility/${callId}`, { token: userToken });
  if (!eligibility.eligible) throw new Error(`Expected eligible review: ${eligibility.reason}`);

  const review = await api('/reviews', {
    method: 'POST',
    token: userToken,
    body: { callId, rating: 5, reviewText: 'Great call experience' },
  });
  if (!review.id || review.rating !== 5) throw new Error('Review not created');

  try {
    await api('/reviews', {
      method: 'POST',
      token: userToken,
      body: { callId, rating: 4 },
    });
    throw new Error('Duplicate review should be blocked');
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code !== 'DUPLICATE_REVIEW') throw err;
  }

  try {
    await api('/reviews', {
      method: 'POST',
      token: hostToken,
      body: { callId, rating: 3 },
    });
    throw new Error('Host review should be blocked');
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code !== 'NOT_CALL_PARTICIPANT' && e.code !== 'HOST_CANNOT_REVIEW') throw err;
  }

  const rejectedCall = await api('/calls/initiate', {
    method: 'POST',
    token: userToken,
    body: { calleeId: hostId },
  });
  await api(`/calls/${rejectedCall.callId}/reject`, { method: 'POST', token: hostToken });
  await new Promise((r) => setTimeout(r, 400));

  try {
    await api('/reviews', {
      method: 'POST',
      token: userToken,
      body: { callId: rejectedCall.callId, rating: 2 },
    });
    throw new Error('Rejected call review should be blocked');
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code !== 'CALL_NOT_COMPLETED') throw err;
  }

  const hostRating = await api('/host/rating', { token: hostToken });
  if (hostRating.totalReviews < 1) throw new Error('Host rating not updated');

  const hostReviews = await api('/host/reviews', { token: hostToken });
  if (!hostReviews.items.some((r: { id: string }) => r.id === review.id)) {
    throw new Error('GET /host/reviews missing review');
  }

  const publicProfile = await api(`/users/${hostId}`, { token: userToken });
  if (!publicProfile.ratingStats?.totalReviews) {
    throw new Error('Host profile ratingStats missing');
  }

  const discover = await api('/hosts/discover?limit=10', { token: userToken });
  const discovered = discover.hosts.find((h: { userId: string }) => h.userId === hostId);
  if (!discovered?.reviewCount) throw new Error('Discover missing reviewCount');

  const adminList = await api('/admin/reviews?limit=10', { token: adminToken });
  if (!adminList.items.some((r: { id: string }) => r.id === review.id)) {
    throw new Error('Admin reviews list missing review');
  }
  if (!adminList.analytics?.reviewsToday && adminList.analytics?.reviewsToday !== 0) {
    throw new Error('Admin analytics missing');
  }

  const adminDetail = await api(`/admin/reviews/${review.id}`, { token: adminToken });
  if (adminDetail.review.id !== review.id) throw new Error('Admin review detail mismatch');

  console.log(
    JSON.stringify(
      {
        passed: true,
        callId,
        reviewId: review.id,
        hostRating: hostRating.averageRating,
        totalReviews: hostRating.totalReviews,
        adminTotal: adminList.total,
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