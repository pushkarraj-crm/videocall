/**
 * Verifies KYC submit → approve → withdrawal gate.
 */
import { PrismaClient, KycVerificationStatus } from '@prisma/client';

import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  const runId = Date.now();
  const hostSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const adminSession = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const hostToken = hostSession.accessToken as string;
  const adminToken = adminSession.accessToken as string;
  const hostId = hostSession.user.id as string;

  await prisma.hostProfile.upsert({
    where: { userId: hostId },
    create: { userId: hostId, withdrawableUnits: 200000n },
    update: { withdrawableUnits: 200000n },
  });

  await prisma.withdrawal.deleteMany({ where: { hostId } });
  await prisma.hostKyc.deleteMany({ where: { userId: hostId } });

  try {
    await api('/hosts/withdrawals', {
      method: 'POST',
      token: hostToken,
      body: {
        upiId: `kycgate${runId}@upi`,
        accountHolderName: 'Test Host',
        amountUnits: 50000,
        idempotencyKey: `verify:kyc:withdraw:${runId}`,
      },
    });
    throw new Error('Withdrawal without KYC should fail');
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (!message.toLowerCase().includes('kyc')) throw err;
  }

  const submitted = await api('/hosts/kyc/submit', {
    method: 'POST',
    token: hostToken,
    body: {
      fullName: 'Test Host',
      dob: '1990-01-15',
      upiId: `kyc${runId}@upi`,
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F',
      selfieImage: TINY_PNG,
      aadhaarFrontImage: TINY_PNG,
      aadhaarBackImage: TINY_PNG,
    },
  });

  const status = await api('/hosts/kyc/status', { token: hostToken });
  if (status.status !== 'PENDING') {
    throw new Error('KYC status should be PENDING after submit');
  }

  const list = await api('/admin/kyc?status=pending', { token: adminToken });
  const row = list.find((k: { id: string }) => k.id === submitted.id);
  if (!row) throw new Error('KYC not visible in admin list');

  await api(`/admin/kyc/${submitted.id}/reject`, {
    method: 'PATCH',
    token: adminToken,
    body: { note: 'Photo unclear' },
  });

  const rejected = await prisma.hostKyc.findUniqueOrThrow({ where: { id: submitted.id } });
  if (rejected.verificationStatus !== KycVerificationStatus.failed) {
    throw new Error('KYC not rejected');
  }

  const resubmitted = await api('/hosts/kyc/submit', {
    method: 'POST',
    token: hostToken,
    body: {
      fullName: 'Test Host',
      dob: '1990-01-15',
      upiId: `kyc${runId}@upi`,
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F',
      selfieImage: TINY_PNG,
      aadhaarFrontImage: TINY_PNG,
      aadhaarBackImage: TINY_PNG,
    },
  });

  await api(`/admin/kyc/${resubmitted.id}/approve`, { method: 'PATCH', token: adminToken });

  await prisma.withdrawal.deleteMany({ where: { hostId } });

  const verified = await prisma.hostKyc.findUniqueOrThrow({ where: { id: resubmitted.id } });
  if (verified.verificationStatus !== KycVerificationStatus.verified) {
    throw new Error('KYC not verified after approve');
  }

  const withdrawal = await api('/hosts/withdrawals', {
    method: 'POST',
    token: hostToken,
    body: {
      upiId: `kycgate${runId}@upi`,
      accountHolderName: 'Test Host',
      amountUnits: 50000,
      idempotencyKey: `verify:kyc:withdraw:ok:${runId}`,
    },
  });

  console.log(
    JSON.stringify(
      {
        passed: true,
        submittedId: submitted.id,
        approvedId: resubmitted.id,
        withdrawalId: withdrawal.id,
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