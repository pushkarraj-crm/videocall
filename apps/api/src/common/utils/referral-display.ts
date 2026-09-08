import { ReferralStatus } from '@prisma/client';
import { unitsToCoins } from '../constants/coins';

export type ReferralDisplayStatus = 'PENDING' | 'COMPLETED' | 'REWARDED' | 'CANCELLED';

export function referralDisplayStatus(status: ReferralStatus): ReferralDisplayStatus {
  switch (status) {
    case ReferralStatus.pending:
      return 'PENDING';
    case ReferralStatus.qualified:
      return 'COMPLETED';
    case ReferralStatus.rewarded:
      return 'REWARDED';
    case ReferralStatus.rejected:
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

const USER_PREVIEW = {
  id: true,
  displayName: true,
  avatarUrl: true,
  phone: true,
  email: true,
} as const;

export type ReferralRow = {
  id: string;
  referrerId: string;
  referredId: string;
  referralCode: string;
  status: ReferralStatus;
  referrerRewardUnits: bigint;
  referredRewardUnits: bigint;
  rewardGiven: boolean;
  qualificationEvent: string | null;
  qualifiedAt: Date | null;
  completedAt: Date | null;
  rewardedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  adminNote: string | null;
  fraudScore: number;
  fraudFlags: unknown;
  holdUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  referrer?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    phone: string | null;
    email: string | null;
  };
  referred?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    phone: string | null;
    email: string | null;
  };
};

export function serializeReferral(row: ReferralRow) {
  const rewardAmount = Number(row.referrerRewardUnits + row.referredRewardUnits);
  return {
    id: row.id,
    referrerId: row.referrerId,
    referredUserId: row.referredId,
    referralCode: row.referralCode,
    status: row.status,
    displayStatus: referralDisplayStatus(row.status),
    rewardAmountUnits: rewardAmount.toString(),
    rewardAmountCoins: unitsToCoins(row.referrerRewardUnits) + unitsToCoins(row.referredRewardUnits),
    referrerRewardCoins: unitsToCoins(row.referrerRewardUnits),
    referredRewardCoins: unitsToCoins(row.referredRewardUnits),
    rewardGiven: row.rewardGiven,
    qualificationEvent: row.qualificationEvent,
    completedAt: row.completedAt ?? row.qualifiedAt,
    rewardedAt: row.rewardedAt,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    adminNote: row.adminNote,
    fraudScore: row.fraudScore,
    fraudFlags: row.fraudFlags,
    holdUntil: row.holdUntil,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    referrer: row.referrer ?? null,
    referredUser: row.referred ?? null,
  };
}

export { USER_PREVIEW as REFERRAL_USER_SELECT };