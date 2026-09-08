import {
  clampRelationshipScore,
  getRelationshipTier,
  relationshipScoreDelta,
} from './relationship-engine';

describe('relationship-engine', () => {
  it('resolves tiers', () => {
    expect(getRelationshipTier(0).label).toBe('First Call');
    expect(getRelationshipTier(25).label).toBe('Friend');
    expect(getRelationshipTier(500).label).toBe('Best Friend');
  });

  it('applies score deltas', () => {
    expect(relationshipScoreDelta('gift')).toBeGreaterThan(0);
    expect(relationshipScoreDelta('abusive')).toBeLessThan(0);
  });

  it('clamps score', () => {
    expect(clampRelationshipScore(2000)).toBe(1000);
    expect(clampRelationshipScore(-5)).toBe(0);
  });
});