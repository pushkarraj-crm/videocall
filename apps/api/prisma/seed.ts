import { ConsentDocumentType, Role } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { generateReferralCode } from '../src/common/utils/referral-code.util';

const prisma = new PrismaClient();

async function ensureDevUser(params: {
  phone: string;
  displayName: string;
  role: 'user' | 'host' | 'admin';
  seedCoins?: number;
}) {
  const firebaseUid = `dev_${params.phone.replace(/\D/g, '')}`;
  let user = await prisma.user.findFirst({ where: { firebaseUid } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        firebaseUid,
        phone: params.phone,
        displayName: params.displayName,
        dateOfBirth: new Date('1995-06-15'),
        referralCode: generateReferralCode(),
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, role: Role.user } });
    await prisma.wallet.create({ data: { userId: user.id } });
  }

  const consentTypes: ConsentDocumentType[] = [
    ConsentDocumentType.terms,
    ConsentDocumentType.privacy,
    ConsentDocumentType.community_guidelines,
    ConsentDocumentType.age_declaration,
  ];

  for (const documentType of consentTypes) {
    const existing = await prisma.userConsent.findFirst({
      where: { userId: user.id, documentType },
    });
    if (!existing) {
      await prisma.userConsent.create({
        data: { userId: user.id, documentType, documentVersion: '1.0' },
      });
    }
  }

  if (params.role === 'host' || params.role === 'admin') {
    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: Role.host } },
      update: { revokedAt: null },
      create: { userId: user.id, role: Role.host },
    });
    await prisma.hostProfile.upsert({
      where: { userId: user.id },
      update: { isAvailable: true },
      create: { userId: user.id, isAvailable: true, approvedAt: new Date() },
    });
  }

  if (params.role === 'admin') {
    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: Role.admin } },
      update: { revokedAt: null },
      create: { userId: user.id, role: Role.admin },
    });
  }

  if (params.seedCoins) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    const units = BigInt(params.seedCoins * 100);
    const key = `seed:dev:${user.id}:${params.seedCoins}`;
    const existing = await prisma.walletTransaction.findUnique({
      where: { idempotencyKey: key },
    });
    if (!existing) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceUnits: { increment: units } },
      });
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'admin_adjustment',
          amountUnits: units,
          balanceAfterUnits: wallet.balanceUnits + units,
          idempotencyKey: key,
          description: 'Dev seed coins',
        },
      });
    }
  }

  return user;
}

async function main() {
  const configs = [
    {
      key: 'billing.coins_per_minute_units',
      value: 500,
      description: 'Coins deducted per minute (500 = 5 coins)',
    },
    {
      key: 'billing.free_call_limit',
      value: 5,
      description: 'Number of free video calls per user',
    },
    {
      key: 'billing.free_call_max_seconds',
      value: 180,
      description: 'Max duration per free call in seconds',
    },
    {
      key: 'billing.host_share_percent',
      value: 70,
      description: 'Host revenue share percentage',
    },
    {
      key: 'referral.reward_units',
      value: 5000,
      description: 'Referral reward per party (5000 = 50 coins)',
    },
    {
      key: 'referral.qualification_window_hours',
      value: 24,
      description: 'Hours after signup to apply referral code',
    },
    {
      key: 'referral.fraud_hold_hours',
      value: 72,
      description: 'Hours to hold referral reward for fraud review',
    },
    {
      key: 'withdrawal.min_units',
      value: 50000,
      description: 'Minimum withdrawal amount (50000 = 500 coins host units)',
    },
    {
      key: 'withdrawal.hold_days',
      value: 7,
      description: 'Days to hold host earnings before withdrawable',
    },
    {
      key: 'abuse.suspend_threshold',
      value: 80,
      description: 'Abuse score threshold for suspension review',
    },
    {
      key: 'abuse.ban_threshold',
      value: 100,
      description: 'Abuse score threshold for ban review',
    },
  ];

  for (const config of configs) {
    await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
  }

  const packages = [
    { name: 'Starter', priceInr: 100, coinUnits: 10000n, bonusUnits: 0n, sortOrder: 1 },
    { name: 'Value', priceInr: 250, coinUnits: 25000n, bonusUnits: 2500n, sortOrder: 2 },
    { name: 'Premium', priceInr: 500, coinUnits: 50000n, bonusUnits: 10000n, sortOrder: 3 },
  ];

  const packageIds: Record<string, string> = {};

  for (const pkg of packages) {
    const existing = await prisma.coinPackage.findFirst({
      where: { name: pkg.name, deletedAt: null },
    });

    if (existing) {
      await prisma.coinPackage.update({
        where: { id: existing.id },
        data: pkg,
      });
      packageIds[pkg.name.toLowerCase()] = existing.id;
    } else {
      const created = await prisma.coinPackage.create({ data: pkg });
      packageIds[pkg.name.toLowerCase()] = created.id;
    }
  }

  await ensureDevUser({
    phone: '+919999990001',
    displayName: 'Dev User',
    role: 'user',
    seedCoins: 500,
  });
  await ensureDevUser({
    phone: '+919999990002',
    displayName: 'Dev Host',
    role: 'host',
    seedCoins: 0,
  });
  await ensureDevUser({
    phone: '+919999990003',
    displayName: 'Dev Admin',
    role: 'admin',
    seedCoins: 0,
  });

  console.log('\n--- Seed complete ---');
  console.log('Coin packages:');
  console.log(`  Starter: ${packageIds.starter}`);
  console.log(`  Value:   ${packageIds.value}`);
  console.log(`  Premium: ${packageIds.premium}`);
  console.log('\nDev accounts (use Dev Login on web when ENABLE_DEV_AUTH=true):');
  console.log('  User:  +919999990001 (500 coins)');
  console.log('  Host:  +919999990002 (available for calls)');
  console.log('  Admin: +919999990003 (admin panel access)');
  console.log('---------------------\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });