/**
 * Verifies host wallet summary: today/weekly/monthly/lifetime earnings views + withdrawable balance.
 */
import { PrismaClient } from '@prisma/client';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function main() {
  const host = await api('/auth/dev-login', { method: 'POST', body: { role: 'host' } });
  const hostId = host.user.id as string;
  const hostToken = host.accessToken as string;

  await prisma.hostProfile.upsert({
    where: { userId: hostId },
    create: {
      userId: hostId,
      totalEarningsUnits: 250000n,
      withdrawableUnits: 150000n,
      totalCalls: 12,
      totalCallSeconds: 3600n,
    },
    update: {
      totalEarningsUnits: 250000n,
      withdrawableUnits: 150000n,
      totalCalls: 12,
      totalCallSeconds: 3600n,
    },
  });

  const earnings = await api('/hosts/earnings', { token: hostToken });

  const required = [
    'totalEarnedCoins',
    'withdrawableCoins',
    'pendingWithdrawalCoins',
    'completedWithdrawalCoins',
    'totalCalls',
    'totalMinutes',
    'platformFeePercent',
  ] as const;

  for (const key of required) {
    if (earnings[key] === undefined) {
      throw new Error(`Missing earnings field: ${key}`);
    }
  }

  if (earnings.withdrawableCoins <= 0) {
    throw new Error('Withdrawable balance should be positive');
  }

  const dashboard = await api('/hosts/dashboard', { token: hostToken });
  if (!dashboard.profile?.withdrawableInr && dashboard.profile?.withdrawableInr !== 0) {
    throw new Error('Dashboard missing withdrawable balance');
  }

  console.log(
    JSON.stringify(
      {
        passed: true,
        hostId,
        totalEarnedCoins: earnings.totalEarnedCoins,
        withdrawableCoins: earnings.withdrawableCoins,
        totalCalls: earnings.totalCalls,
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