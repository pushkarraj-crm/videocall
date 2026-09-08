import { serializeHostRatingSummary, serializeReview } from './review-display';

describe('review-display', () => {
  it('serializes review row', () => {
    const row = {
      id: 'r1',
      callId: 'c1',
      hostId: 'h1',
      userId: 'u1',
      rating: 5,
      reviewText: 'Great',
      isHidden: false,
      isReported: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      user: { id: 'u1', displayName: 'User', avatarUrl: null },
    };
    const out = serializeReview(row);
    expect(out.rating).toBe(5);
    expect(out.user?.displayName).toBe('User');
  });

  it('serializes host rating summary', () => {
    const out = serializeHostRatingSummary({
      ratingSum: 47,
      ratingCount: 10,
      totalCalls: 100,
    });
    expect(out.averageRating).toBe(4.7);
    expect(out.totalReviews).toBe(10);
  });
});