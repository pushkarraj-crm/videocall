import { RiskLevel } from '@prisma/client';
import { mergeScores, scoreToRiskLevel } from './risk-score';

describe('risk-score', () => {
  it('maps score bands to levels', () => {
    expect(scoreToRiskLevel(10)).toBe(RiskLevel.low);
    expect(scoreToRiskLevel(40)).toBe(RiskLevel.medium);
    expect(scoreToRiskLevel(60)).toBe(RiskLevel.high);
    expect(scoreToRiskLevel(90)).toBe(RiskLevel.critical);
  });

  it('merges multiple rule scores', () => {
    expect(mergeScores([80, 20])).toBeGreaterThan(50);
    expect(mergeScores([])).toBe(0);
  });
});