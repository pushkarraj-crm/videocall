import type { HostProfile } from '@prisma/client';
import { unitsToCoins } from '../constants/coins';
import { hostCoinsToInr, hostUnitsToInr } from './host-inr';
import {
  canReceiveCalls,
  formatLastSeenLabel,
  resolveHostStatus,
} from './host-status';

export function serializeHostProfile(profile: HostProfile) {
  const status = resolveHostStatus(profile.isOnline, profile.isBusy);

  return {
    userId: profile.userId,
    isAvailable: profile.isAvailable,
    isOnline: profile.isOnline,
    isBusy: profile.isBusy,
    status,
    lastSeenAt: profile.lastSeenAt,
    lastSeenLabel: formatLastSeenLabel(profile.lastSeenAt, profile.isOnline, profile.isBusy),
    canReceiveCalls: canReceiveCalls(profile.isOnline, profile.isBusy),
    hostBio: profile.hostBio,
    languages: profile.languages,
    totalCalls: profile.totalCalls,
    ratingSum: profile.ratingSum,
    ratingCount: profile.ratingCount,
    approvedAt: profile.approvedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    totalEarningsUnits: profile.totalEarningsUnits.toString(),
    withdrawableUnits: profile.withdrawableUnits.toString(),
    totalCallSeconds: profile.totalCallSeconds.toString(),
    totalEarningsCoins: unitsToCoins(profile.totalEarningsUnits),
    withdrawableCoins: unitsToCoins(profile.withdrawableUnits),
    totalEarningsInr: hostUnitsToInr(profile.totalEarningsUnits),
    withdrawableInr: hostUnitsToInr(profile.withdrawableUnits),
    rating:
      profile.ratingCount > 0 ? profile.ratingSum / profile.ratingCount : null,
  };
}