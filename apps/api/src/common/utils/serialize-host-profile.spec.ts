import type { HostProfile } from '@prisma/client';
import { serializeHostProfile } from './serialize-host-profile';

const baseHost = (overrides: Partial<HostProfile> = {}): HostProfile => ({
  userId: 'user-1',
  isAvailable: true,
  isOnline: true,
  isBusy: false,
  lastSeenAt: null,
  hostBio: null,
  languages: [],
  totalEarningsUnits: 0n,
  withdrawableUnits: 0n,
  totalCalls: 0,
  totalCallSeconds: 0n,
  ratingSum: 0,
  ratingCount: 0,
  approvedAt: null,
  adminCallsDisabled: false,
  adminWithdrawalsDisabled: false,
  profileType: 'REAL_HOST',
  virtualHostEnabled: false,
  virtualHostPriority: 0,
  virtualHostVoice: null,
  virtualHostAvatar: null,
  virtualHostPersonality: null,
  virtualHostLanguage: null,
  virtualHostRegion: null,
  virtualHostGreeting: null,
  virtualHostStatus: null,
  virtualHostGiftReactions: null,
  virtualHostSchedule: null,
  virtualHostPopularity: 0,
  virtualHostConversation: null,
  virtualHostVideo: null,
  virtualHostWardrobe: null,
  virtualHostAssetSlug: null,
  virtualHostGallery: [],
  virtualHostUsername: null,
  coinsPerMinuteUnits: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('serializeHostProfile', () => {
  it('converts BigInt fields to strings and coin amounts', () => {
    const result = serializeHostProfile(
      baseHost({
        totalEarningsUnits: 150000n,
        withdrawableUnits: 50000n,
        totalCalls: 3,
        totalCallSeconds: 3600n,
        ratingSum: 10,
        ratingCount: 2,
        approvedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }),
    );

    expect(result.totalEarningsUnits).toBe('150000');
    expect(result.withdrawableUnits).toBe('50000');
    expect(result.totalCallSeconds).toBe('3600');
    expect(result.totalEarningsCoins).toBe(1500);
    expect(result.withdrawableCoins).toBe(500);
    expect(result.rating).toBe(5);
  });

  it('returns null rating when there are no ratings', () => {
    const result = serializeHostProfile(
      baseHost({
        userId: 'user-2',
        isAvailable: false,
        isOnline: false,
        lastSeenAt: new Date('2026-06-25T10:00:00Z'),
      }),
    );

    expect(result.rating).toBeNull();
  });
});