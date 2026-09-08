import { ReportCategory, ReportStatus } from '@prisma/client';
import {
  reportDisplayStatus,
  REPORT_REASON_LABELS,
  resolveRiskLevel,
} from './report-display';

describe('report-display', () => {
  it('maps statuses to display labels', () => {
    expect(reportDisplayStatus(ReportStatus.open)).toBe('OPEN');
    expect(reportDisplayStatus(ReportStatus.reviewing)).toBe('UNDER_REVIEW');
    expect(reportDisplayStatus(ReportStatus.resolved)).toBe('RESOLVED');
    expect(reportDisplayStatus(ReportStatus.dismissed)).toBe('REJECTED');
  });

  it('labels production reasons', () => {
    expect(REPORT_REASON_LABELS[ReportCategory.spam]).toBe('Spam');
    expect(REPORT_REASON_LABELS[ReportCategory.fake_profile]).toBe('Fake Profile');
    expect(REPORT_REASON_LABELS[ReportCategory.harassment]).toBe('Harassment');
  });

  it('computes risk recommendations without auto action', () => {
    expect(resolveRiskLevel(1)).toBe('NONE');
    expect(resolveRiskLevel(3)).toBe('FLAGGED');
    expect(resolveRiskLevel(10)).toBe('HIGH_RISK');
    expect(resolveRiskLevel(20)).toBe('RECOMMEND_SUSPENSION');
  });
});