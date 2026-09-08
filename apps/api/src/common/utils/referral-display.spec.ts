import { ReferralStatus } from '@prisma/client';
import { referralDisplayStatus, serializeReferral } from './referral-display';

describe('referral-display', () => {
  it('maps statuses to display labels', () => {
    expect(referralDisplayStatus(ReferralStatus.pending)).toBe('PENDING');
    expect(referralDisplayStatus(ReferralStatus.qualified)).toBe('COMPLETED');
    expect(referralDisplayStatus(ReferralStatus.rewarded)).toBe('REWARDED');
    expect(referralDisplayStatus(ReferralStatus.rejected)).toBe('CANCELLED');
  });

  it('serializes referral row', () => {
    const out = serializeReferral({
      id: 'r1',
      referrerId: 'a',
      referredId: 'b',
      referralCode: 'WHO-ABC123',
      status: ReferralStatus.pending,
      referrerRewardUnits: 10_000n,
      referredRewardUnits: 5_000n,
      rewardGiven: false,
      qualificationEvent: null,
      qualifiedAt: null,
      completedAt: null,
      rewardedAt: null,
      cancelledAt: null,
      cancelReason: null,
      adminNote: null,
      fraudScore: 0,
      fraudFlags: null,
      holdUntil: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });
    expect(out.displayStatus).toBe('PENDING');
    expect(out.referrerRewardCoins).toBe(100);
  });
});