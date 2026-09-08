import { growthPercent, serializeFollowerUser } from './follow-display';

describe('follow-display', () => {
  it('computes growth percent', () => {
    expect(growthPercent(15, 10)).toBe(50);
    expect(growthPercent(0, 0)).toBeNull();
    expect(growthPercent(5, 0)).toBe(100);
  });

  it('serializes follower user', () => {
    const out = serializeFollowerUser(
      {
        id: 'f1',
        userId: 'u1',
        hostId: 'h1',
        createdAt: new Date('2026-01-01'),
        deletedAt: null,
        user: { id: 'u1', displayName: 'User', avatarUrl: null },
      },
      3,
    );
    expect(out.completedCalls).toBe(3);
    expect(out.user.displayName).toBe('User');
  });
});