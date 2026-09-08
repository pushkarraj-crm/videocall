import { ConsentDocumentType, Gender, Role } from '@prisma/client';
import { DEFAULT_GIFT_REACTIONS } from '../src/common/utils/virtual-host';
import { PrismaClient } from '@prisma/client';
import { generateReferralCode } from '../src/common/utils/referral-code.util';
import {
  INITIAL_POLICY_VERSION,
  LEGAL_POLICY_DEFAULTS,
} from '../src/common/utils/legal-policy-defaults';

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
      const newBalance = wallet.balanceUnits + units;
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balanceUnits: newBalance,
          lifetimeCreditedUnits: { increment: units },
        },
      });
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: user.id,
          type: 'admin_adjustment',
          amountUnits: units,
          balanceAfterUnits: newBalance,
          idempotencyKey: key,
          description: 'Dev seed coins',
        },
      });
    }
  }

  return user;
}

async function ensureVirtualHost(params: {
  phone: string;
  displayName: string;
  bio: string;
  language: string;
  region: string;
  personality: string;
  priority: number;
  popularity: number;
}) {
  const firebaseUid = `dev_vh_${params.phone.replace(/\D/g, '')}`;
  let user =
    (await prisma.user.findFirst({ where: { firebaseUid } })) ??
    (await prisma.user.findFirst({ where: { phone: params.phone } }));

  if (!user) {
    user = await prisma.user.create({
      data: {
        firebaseUid,
        phone: params.phone,
        displayName: params.displayName,
        bio: params.bio,
        gender: Gender.female,
        primaryLanguage: params.language,
        dateOfBirth: new Date('1998-03-20'),
        referralCode: generateReferralCode(),
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(params.displayName)}`,
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, role: Role.user } });
    await prisma.wallet.create({ data: { userId: user.id } });
  }

  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: Role.host } },
    update: { revokedAt: null },
    create: { userId: user.id, role: Role.host },
  });

  await prisma.hostProfile.upsert({
    where: { userId: user.id },
    update: {
      profileType: 'AI_HOST',
      virtualHostEnabled: true,
      virtualHostStatus: 'ONLINE',
      virtualHostPriority: params.priority,
      virtualHostPopularity: params.popularity,
      isOnline: true,
      isBusy: false,
      isAvailable: true,
      adminWithdrawalsDisabled: true,
    },
    create: {
      userId: user.id,
      approvedAt: new Date(),
      profileType: 'AI_HOST',
      virtualHostEnabled: true,
      virtualHostStatus: 'ONLINE',
      virtualHostPriority: params.priority,
      virtualHostPopularity: params.popularity,
      virtualHostLanguage: params.language,
      virtualHostRegion: params.region,
      virtualHostGreeting: `Hey! I'm ${params.displayName} — so happy you called!`,
      virtualHostVoice: {
        provider: 'default',
        voiceId: 'warm_female_1',
        speed: 1,
        pitch: 1,
        emotion: 'friendly',
        language: params.language,
      },
      virtualHostAvatar: {
        imageUrl: user.avatarUrl,
        idleAnimation: 'idle_breathe',
        talkAnimation: 'talk_nod',
        smileAnimation: 'smile_soft',
        giftReactionAnimation: 'gift_sparkle',
        callEndAnimation: 'wave_goodbye',
        typingAnimation: 'typing_dots',
        defaultIdleAnimation: 'breathe',
        expressionIntensity: 0.75,
        blinkFrequency: 'medium',
        headMovement: 'normal',
        reactionsEnabled: true,
        lipSyncIntensity: 0.8,
      },
      virtualHostVideo: {
        enabled: true,
        renderMode: 'cinematic',
        cameraMode: 'auto',
        autoZoom: true,
        dynamicFraming: true,
        lipSyncMode: 'phoneme',
        idleDrift: true,
        eyeTracking: true,
      },
      virtualHostWardrobe: {
        activeOutfitId: `outfit_${params.displayName.toLowerCase()}_casual`,
        outfits: [
          {
            id: `outfit_${params.displayName.toLowerCase()}_casual`,
            name: 'Casual',
            category: 'casual',
            imageUrl: user.avatarUrl,
            approved: true,
          },
        ],
      },
      virtualHostPersonality: {
        style: params.personality,
        responseStyle: 'warm',
        emojiUsage: 'medium',
        speakingSpeed: 'normal',
      },
      virtualHostGiftReactions: DEFAULT_GIFT_REACTIONS,
      virtualHostSchedule: { timezone: 'Asia/Kolkata', alwaysOn: true },
      hostBio: params.bio,
      languages: [params.language],
      isOnline: true,
      isBusy: false,
      isAvailable: true,
      adminWithdrawalsDisabled: true,
      ratingSum: 45,
      ratingCount: 10,
      totalCalls: 120,
    },
  });

  return user;
}

async function seedLegalPolicies() {
  const now = new Date();
  for (const policy of LEGAL_POLICY_DEFAULTS) {
    const existing = await prisma.legalPolicy.findUnique({ where: { slug: policy.slug } });
    if (existing) continue;

    await prisma.legalPolicy.create({
      data: {
        slug: policy.slug,
        title: policy.title,
        content: policy.content,
        version: INITIAL_POLICY_VERSION,
        isPublished: true,
        publishedAt: now,
      },
    });
    await prisma.legalPolicyRevision.create({
      data: {
        slug: policy.slug,
        title: policy.title,
        content: policy.content,
        version: INITIAL_POLICY_VERSION,
        publishedAt: now,
      },
    });
  }
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

  await prisma.coinPackage.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const packages = [
    { name: 'Starter', priceInr: 19, mrpInr: 29, coinUnits: 1500n, bonusUnits: 0n, sortOrder: 1, isBestValue: false, isMostPopular: false, isLimitedOffer: false },
    { name: 'Popular', priceInr: 49, mrpInr: 69, coinUnits: 4500n, bonusUnits: 0n, sortOrder: 2, isBestValue: false, isMostPopular: true, isLimitedOffer: false },
    { name: 'Value', priceInr: 99, mrpInr: 149, coinUnits: 10000n, bonusUnits: 0n, sortOrder: 3, isBestValue: false, isMostPopular: false, isLimitedOffer: true },
    { name: 'Plus', priceInr: 249, mrpInr: 349, coinUnits: 27500n, bonusUnits: 0n, sortOrder: 4, isBestValue: false, isMostPopular: false, isLimitedOffer: false },
    { name: 'Pro', priceInr: 499, mrpInr: 699, coinUnits: 60000n, bonusUnits: 0n, sortOrder: 5, isBestValue: false, isMostPopular: false, isLimitedOffer: false },
    { name: 'Mega', priceInr: 999, mrpInr: 1499, coinUnits: 130000n, bonusUnits: 0n, sortOrder: 6, isBestValue: true, isMostPopular: false, isLimitedOffer: false },
  ];

  const packageIds: Record<string, string> = {};

  for (const pkg of packages) {
    const existing = await prisma.coinPackage.findFirst({
      where: { name: pkg.name, deletedAt: null },
    });

    if (existing) {
      await prisma.coinPackage.update({
        where: { id: existing.id },
        data: { ...pkg, isActive: true },
      });
      packageIds[pkg.name.toLowerCase()] = existing.id;
    } else {
      const created = await prisma.coinPackage.create({ data: { ...pkg, isActive: true } });
      packageIds[pkg.name.toLowerCase()] = created.id;
    }
  }

  await ensureDevUser({
    phone: '+919999990001',
    displayName: 'Dev User',
    role: 'user',
    seedCoins: 0,
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

  await ensureVirtualHost({
    phone: '+919999990101',
    displayName: 'Aanya',
    bio: 'Friendly conversations & good vibes ✨ Languages: en, hi',
    language: 'en',
    region: 'IN',
    personality: 'Friendly',
    priority: 90,
    popularity: 100,
  });
  await ensureVirtualHost({
    phone: '+919999990102',
    displayName: 'Riya',
    bio: 'Romantic chats & late-night talks 💫 Languages: en, hi',
    language: 'hi',
    region: 'IN',
    personality: 'Romantic',
    priority: 80,
    popularity: 85,
  });
  await ensureVirtualHost({
    phone: '+919999990103',
    displayName: 'Mia',
    bio: 'Gaming & fun banter 🎮 Languages: en',
    language: 'en',
    region: 'US',
    personality: 'Gaming',
    priority: 70,
    popularity: 60,
  });

  await seedLegalPolicies();

  console.log('\n--- Seed complete ---');
  console.log('Coin packages:');
  for (const [name, id] of Object.entries(packageIds)) {
    console.log(`  ${name}: ${id}`);
  }
  console.log('\nDev accounts (use Dev Login on web when ENABLE_DEV_AUTH=true):');
  console.log('  User:  +919999990001 (0 coins, 5 free calls)');
  console.log('  Host:  +919999990002 (available for calls)');
  console.log('  Admin: +919999990003 (admin panel access)');
  console.log('Virtual hosts (always online in Discover):');
  console.log('  Aanya: +919999990101');
  console.log('  Riya:  +919999990102');
  console.log('  Mia:   +919999990103');
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