import { PrismaClient } from '@prisma/client';

type UserFingerprint = {
  id: string;
  phone: string | null;
  email: string | null;
  firebaseUid: string;
  deviceFingerprint: string | null;
};

type PrismaLike = Pick<PrismaClient, 'referral' | 'user' | 'payment'>;

export interface ReferralFraudResult {
  score: number;
  flags: string[];
  block: boolean;
}

export async function assessReferralFraud(
  prisma: PrismaLike,
  referrer: UserFingerprint,
  referred: UserFingerprint,
  meta?: { ip?: string; deviceFingerprint?: string },
): Promise<ReferralFraudResult> {
  const flags: string[] = [];
  let score = 0;

  if (referrer.id === referred.id) {
    return { score: 100, flags: ['self_referral'], block: true };
  }

  if (referrer.phone && referred.phone && referrer.phone === referred.phone) {
    flags.push('duplicate_phone');
    score += 40;
  }

  if (referrer.email && referred.email && referrer.email === referred.email) {
    flags.push('duplicate_email');
    score += 40;
  }

  const referredDevice = meta?.deviceFingerprint ?? referred.deviceFingerprint;
  if (referredDevice && referrer.deviceFingerprint === referredDevice) {
    flags.push('same_device');
    score += 50;
  }

  if (referredDevice) {
    const dupDevice = await prisma.referral.findFirst({
      where: {
        referrerId: referrer.id,
        referredDeviceFingerprint: referredDevice,
        status: { not: 'rejected' },
      },
      select: { id: true },
    });
    if (dupDevice) {
      flags.push('duplicate_device_referral');
      score += 35;
    }
  }

  if (meta?.ip) {
    const dupIp = await prisma.referral.findFirst({
      where: {
        referrerId: referrer.id,
        referredIp: meta.ip,
        status: { not: 'rejected' },
      },
      select: { id: true },
    });
    if (dupIp) {
      flags.push('duplicate_ip_referral');
      score += 25;
    }
  }

  const paidByReferred = await prisma.payment.count({
    where: { userId: referred.id, status: 'paid' },
  });
  if (paidByReferred > 0) {
    flags.push('existing_payment');
    score += 30;
  }

  return { score, flags, block: score >= 70 };
}