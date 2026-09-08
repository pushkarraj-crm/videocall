import {
  CallHistoryStatus,
  KycVerificationStatus,
  PrismaClient,
} from '@prisma/client';
import {
  computeAvgResponseTimeSeconds,
  computeResponseRate,
} from './host-rating-stats';

type PrismaLike = Pick<PrismaClient, 'hostProfile' | 'callHistory' | 'hostKyc'>;

export async function fetchPublicHostStats(prisma: PrismaLike, hostId: string) {
  const profile = await prisma.hostProfile.findUnique({
    where: { userId: hostId },
  });
  if (!profile) return null;

  const [historyCounts, responseRows, kycVerified] = await Promise.all([
    prisma.callHistory.groupBy({
      by: ['status'],
      where: { hostId },
      _count: true,
    }),
    prisma.callHistory.findMany({
      where: {
        hostId,
        status: { in: [CallHistoryStatus.completed, CallHistoryStatus.connected] },
        answeredAt: { not: null },
      },
      select: { createdAt: true, answeredAt: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.hostKyc.findFirst({
      where: { userId: hostId, verificationStatus: KycVerificationStatus.verified },
      select: { id: true },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    historyCounts.map((r) => [r.status, r._count]),
  ) as Partial<Record<CallHistoryStatus, number>>;
  const completed = statusCounts[CallHistoryStatus.completed] ?? 0;
  const missed = statusCounts[CallHistoryStatus.missed] ?? 0;
  const rejected = statusCounts[CallHistoryStatus.rejected] ?? 0;

  return {
    averageRating:
      profile.ratingCount > 0 ? profile.ratingSum / profile.ratingCount : null,
    totalReviews: profile.ratingCount,
    totalCalls: profile.totalCalls,
    responseRate: computeResponseRate(completed, missed, rejected),
    responseTimeSeconds: computeAvgResponseTimeSeconds(responseRows),
    memberSince: profile.approvedAt ?? profile.createdAt,
    languages: profile.languages,
    isVerified: Boolean(kycVerified),
  };
}