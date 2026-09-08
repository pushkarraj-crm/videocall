/**
 * Verifies paid call → coin deduction → host earning record → fee split → pending balance.
 * Run: npx ts-node scripts/verify-host-earnings.ts
 */
import { PrismaClient, HostEarningStatus, WalletTransactionType } from '@prisma/client';
import { unitsToCoins } from '../src/common/constants/coins';
import { BALANCE_AFFECTING_TX_TYPES } from '../src/modules/wallet/wallet-consistency';

const API = process.env.API_URL ?? 'http://localhost:3001/v1';
const prisma = new PrismaClient();

async function api(path: string, opts: { method?: string; token?: string; body?: object } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `API ${path} failed`);
  }
  return json.data;
}

async function main() {
  const userSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'user' } });
  const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });

  const callerId = userSession.user.id;
  const hostId = hostSession.user.id;

  await prisma.user.update({
    where: { id: callerId },
    data: { freeCallsUsed: 5 },
  });

  const minUnits = 500000n;
  const topUpKey = `verify:host-earnings:topup:${callerId}`;
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

    if (wallet.balanceUnits !== txSum) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balanceUnits: txSum,
          lifetimeCreditedUnits: txSum + wallet.lifetimeDebitedUnits,
        },
      });
    }

    if (txSum >= minUnits) return;

    const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: topUpKey } });
    if (existing) return;

    const topUpUnits = minUnits - txSum;
    const newBalance = txSum + topUpUnits;
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceUnits: newBalance,
        lifetimeCreditedUnits: wallet.lifetimeDebitedUnits + newBalance,
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: updated.id,
        userId: callerId,
        type: WalletTransactionType.payment_credit,
        amountUnits: topUpUnits,
        balanceAfterUnits: newBalance,
        idempotencyKey: topUpKey,
        description: 'Verification top-up',
      },
    });
  });

  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { isAvailable: true },
  });

  const walletBefore = await prisma.wallet.findUniqueOrThrow({ where: { userId: callerId } });

  const hosts = await api('/hosts/discover?limit=5', { token: userSession.accessToken });
  const targetHost = hosts.hosts.find((h: { userId: string }) => h.userId === hostId);
  if (!targetHost) throw new Error('Dev host not discoverable');

  const initiated = await api('/calls/initiate', {
    method: 'POST',
    token: userSession.accessToken,
    body: { calleeId: hostId },
  });

  if (initiated.isFreeCall) {
    throw new Error('Expected paid call but got free call');
  }

  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: userSession.accessToken,
    body: { documentVersion: '1.0' },
  });
  await api(`/calls/${initiated.callId}/consent`, {
    method: 'POST',
    token: hostSession.accessToken,
    body: { documentVersion: '1.0' },
  });
  await api(`/calls/${initiated.callId}/accept`, { method: 'POST', token: hostSession.accessToken });

  await prisma.call.update({
    where: { id: initiated.callId },
    data: { startedAt: new Date(Date.now() - 60_000) },
  });

  const tick = await api(`/calls/${initiated.callId}/billing-tick`, {
    method: 'POST',
    token: userSession.accessToken,
  });

  if (!tick.billed) {
    throw new Error(`Billing tick failed: ${tick.reason ?? 'unknown'}`);
  }

  await api(`/calls/${initiated.callId}/end`, {
    method: 'POST',
    token: userSession.accessToken,
  });

  const walletAfter = await prisma.wallet.findUniqueOrThrow({ where: { userId: callerId } });
  const coinsDeducted = unitsToCoins(walletBefore.balanceUnits - walletAfter.balanceUnits);

  const newEarnings = await prisma.hostEarning.findMany({
    where: { hostId, callId: initiated.callId },
    orderBy: { createdAt: 'asc' },
  });

  const summary = await api('/hosts/earnings', { token: hostSession.accessToken });

  const platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 30);
  const hostSharePercent = 100 - platformFeePercent;

  const earning = newEarnings[0];
  if (!earning) throw new Error('No host earning record created');

  const expectedHostUnits =
    (earning.grossUnits * BigInt(hostSharePercent)) / 100n;
  const expectedFeeUnits = earning.grossUnits - expectedHostUnits;

  const checks = {
    coinsDeducted: coinsDeducted > 0,
    earningCreated: newEarnings.length > 0,
    platformFeeCorrect: earning.platformFeeUnits === expectedFeeUnits,
    hostShareCorrect: earning.netUnits === expectedHostUnits,
    statusPending: earning.status === HostEarningStatus.held,
    pendingBalanceUpdated: summary.pendingBalanceCoins > 0,
    totalCallsIncremented: summary.totalCalls > 0,
  };

  const passed = Object.values(checks).every(Boolean);

  console.log(
    JSON.stringify(
      {
        passed,
        callId: initiated.callId,
        coinsDeducted,
        earning: {
          grossUnits: earning.grossUnits.toString(),
          platformFeeUnits: earning.platformFeeUnits.toString(),
          netUnits: earning.netUnits.toString(),
          status: earning.status,
        },
        summary: {
          pendingBalanceInr: summary.pendingBalanceInr,
          availableBalanceInr: summary.availableBalanceInr,
          totalCalls: summary.totalCalls,
          totalMinutes: summary.totalMinutes,
        },
        checks,
      },
      null,
      2,
    ),
  );

  if (!passed) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());