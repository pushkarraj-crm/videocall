/**
 * Verifies host withdrawal request lifecycle:
 * create → approve → mark paid, and reject restores balance.
 */
import { KycVerificationStatus, PrismaClient, WithdrawalStatus } from '@prisma/client';

import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function main() {
  const runId = Date.now();
  const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const hostId = hostSession.user.id as string;
  const hostToken = hostSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;

  await prisma.hostProfile.upsert({
    where: { userId: hostId },
    create: {
      userId: hostId,
      withdrawableUnits: 600000n,
      totalEarningsUnits: 600000n,
    },
    update: { withdrawableUnits: 600000n },
  });

  await prisma.withdrawal.deleteMany({ where: { hostId } });
  await prisma.hostKyc.deleteMany({ where: { userId: hostId } });
  await prisma.hostKyc.create({
    data: {
      userId: hostId,
      verificationStatus: KycVerificationStatus.verified,
      verifiedAt: new Date(),
      fullName: 'Test Host',
    },
  });

  const before = await prisma.hostProfile.findUniqueOrThrow({ where: { userId: hostId } });

  const created = await api('/hosts/withdrawals', {
    method: 'POST',
    token: hostToken,
    body: {
      upiId: `host${runId}@upi`,
      accountHolderName: 'Test Host',
      amountUnits: 100000,
      idempotencyKey: `verify:withdraw:${runId}`,
    },
  });

  const afterCreate = await prisma.hostProfile.findUniqueOrThrow({ where: { userId: hostId } });
  if (afterCreate.withdrawableUnits !== before.withdrawableUnits - 100000n) {
    throw new Error('Balance not deducted on withdrawal create');
  }

  await api(`/admin/withdrawals/${created.id}/approve`, {
    method: 'PATCH',
    token: adminToken,
    body: { note: 'Approved for payout' },
  });

  const approved = await prisma.withdrawal.findUniqueOrThrow({ where: { id: created.id } });
  if (approved.status !== WithdrawalStatus.approved) {
    throw new Error('Withdrawal not approved');
  }

  await api(`/admin/withdrawals/${created.id}/paid`, {
    method: 'PATCH',
    token: adminToken,
    body: { note: 'Payment sent' },
  });

  const paid = await prisma.withdrawal.findUniqueOrThrow({ where: { id: created.id } });
  if (paid.status !== WithdrawalStatus.completed) {
    throw new Error('Withdrawal not marked paid');
  }

  // Reject flow restores balance
  await prisma.hostProfile.update({
    where: { userId: hostId },
    data: { withdrawableUnits: 200000n },
  });

  const rejectRun = await api('/hosts/withdrawals', {
    method: 'POST',
    token: hostToken,
    body: {
      upiId: `reject${runId}@upi`,
      accountHolderName: 'Test Host',
      amountUnits: 50000,
      idempotencyKey: `verify:withdraw:reject:${runId}`,
    },
  });

  const midBalance = await prisma.hostProfile.findUniqueOrThrow({ where: { userId: hostId } });

  await api(`/admin/withdrawals/${rejectRun.id}/reject`, {
    method: 'PATCH',
    token: adminToken,
    body: { reason: 'Incorrect UPI' },
  });

  const afterReject = await prisma.hostProfile.findUniqueOrThrow({ where: { userId: hostId } });
  if (afterReject.withdrawableUnits !== midBalance.withdrawableUnits + 50000n) {
    throw new Error('Balance not restored on rejection');
  }

  const history = await api('/hosts/withdrawals?page=1&limit=10', { token: hostToken });
  if (!Array.isArray(history.items) || history.items.length < 2) {
    throw new Error('Withdrawal history not updated');
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        createdId: created.id,
        rejectId: rejectRun.id,
        historyCount: history.items.length,
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