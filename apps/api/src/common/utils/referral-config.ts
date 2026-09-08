import { Prisma, PrismaClient } from '@prisma/client';

export type ReferralCompletionRule = 'first_recharge' | 'first_paid_call' | 'either';

export interface ReferralProgramConfig {
  enabled: boolean;
  inviterRewardUnits: number;
  invitedRewardUnits: number;
  completionRule: ReferralCompletionRule;
  expiryDays: number;
  maxDailyRewards: number;
  holdHours: number;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralProgramConfig = {
  enabled: true,
  inviterRewardUnits: 10_000,
  invitedRewardUnits: 5_000,
  completionRule: 'either',
  expiryDays: 30,
  maxDailyRewards: 20,
  holdHours: 72,
};

type PrismaLike = Pick<PrismaClient, 'platformConfig'>;

export async function getReferralProgramConfig(
  prisma: PrismaLike,
  envFallback?: Partial<ReferralProgramConfig>,
): Promise<ReferralProgramConfig> {
  const row = await prisma.platformConfig.findUnique({
    where: { key: 'referral_program' },
  });

  const envDefaults: ReferralProgramConfig = {
    ...DEFAULT_REFERRAL_CONFIG,
    inviterRewardUnits: envFallback?.inviterRewardUnits ?? DEFAULT_REFERRAL_CONFIG.inviterRewardUnits,
    invitedRewardUnits: envFallback?.invitedRewardUnits ?? DEFAULT_REFERRAL_CONFIG.invitedRewardUnits,
    ...envFallback,
  };

  if (!row?.value || typeof row.value !== 'object') {
    return envDefaults;
  }

  const v = row.value as Partial<ReferralProgramConfig>;
  return {
    enabled: v.enabled ?? envDefaults.enabled,
    inviterRewardUnits: v.inviterRewardUnits ?? envDefaults.inviterRewardUnits,
    invitedRewardUnits: v.invitedRewardUnits ?? envDefaults.invitedRewardUnits,
    completionRule: v.completionRule ?? envDefaults.completionRule,
    expiryDays: v.expiryDays ?? envDefaults.expiryDays,
    maxDailyRewards: v.maxDailyRewards ?? envDefaults.maxDailyRewards,
    holdHours: v.holdHours ?? envDefaults.holdHours,
  };
}

export async function saveReferralProgramConfig(
  prisma: PrismaLike,
  config: ReferralProgramConfig,
  updatedById?: string,
) {
  return prisma.platformConfig.upsert({
    where: { key: 'referral_program' },
    create: {
      key: 'referral_program',
      value: config as unknown as Prisma.InputJsonValue,
      description: 'Referral program settings',
      updatedById: updatedById ?? null,
    },
    update: {
      value: config as unknown as Prisma.InputJsonValue,
      updatedById: updatedById ?? null,
    },
  });
}