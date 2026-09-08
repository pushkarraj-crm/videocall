import { Report, ReportCategory, ReportStatus } from '@prisma/client';

export type ReportDisplayStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export type ReportRiskLevel = 'NONE' | 'FLAGGED' | 'HIGH_RISK' | 'RECOMMEND_SUSPENSION';

export const REPORT_REASON_LABELS: Record<ReportCategory, string> = {
  spam: 'Spam',
  fake_profile: 'Fake Profile',
  abusive_language: 'Abusive Language',
  nudity: 'Nudity',
  harassment: 'Harassment',
  scam: 'Scam',
  underage: 'Underage',
  other: 'Other',
  inappropriate_content: 'Nudity',
  fraud: 'Scam',
  minor_safety: 'Underage',
  impersonation: 'Fake Profile',
};

export const REPORT_REASONS: ReportCategory[] = [
  ReportCategory.spam,
  ReportCategory.fake_profile,
  ReportCategory.abusive_language,
  ReportCategory.nudity,
  ReportCategory.harassment,
  ReportCategory.scam,
  ReportCategory.underage,
  ReportCategory.other,
];

export function reportDisplayStatus(status: ReportStatus): ReportDisplayStatus {
  switch (status) {
    case ReportStatus.reviewing:
    case ReportStatus.escalated:
      return 'UNDER_REVIEW';
    case ReportStatus.resolved:
      return 'RESOLVED';
    case ReportStatus.dismissed:
      return 'REJECTED';
    default:
      return 'OPEN';
  }
}

export function resolveRiskLevel(reportCount: number): ReportRiskLevel {
  if (reportCount >= 20) return 'RECOMMEND_SUSPENSION';
  if (reportCount >= 10) return 'HIGH_RISK';
  if (reportCount >= 3) return 'FLAGGED';
  return 'NONE';
}

export type SerializedReport = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  callId: string | null;
  reason: ReportCategory;
  reasonLabel: string;
  description: string | null;
  status: ReportStatus;
  displayStatus: ReportDisplayStatus;
  severity: string;
  adminNote: string | null;
  resolution: string | null;
  resolutionAction: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  riskLevel: ReportRiskLevel;
  reporter?: { id: string; displayName: string; avatarUrl: string | null };
  reportedUser?: { id: string; displayName: string; avatarUrl: string | null };
};

export function serializeReport(
  row: Report & {
    reporter?: { id: string; displayName: string; avatarUrl: string | null };
    reported?: { id: string; displayName: string; avatarUrl: string | null };
  },
  reportCountAgainstUser = 0,
): SerializedReport {
  return {
    id: row.id,
    reporterId: row.reporterId,
    reportedUserId: row.reportedId,
    callId: row.callId,
    reason: row.category,
    reasonLabel: REPORT_REASON_LABELS[row.category] ?? row.category,
    description: row.description,
    status: row.status,
    displayStatus: reportDisplayStatus(row.status),
    severity: row.severity,
    adminNote: row.adminNote,
    resolution: row.resolution,
    resolutionAction: row.resolutionAction,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    riskLevel: resolveRiskLevel(reportCountAgainstUser),
    reporter: row.reporter,
    reportedUser: row.reported,
  };
}