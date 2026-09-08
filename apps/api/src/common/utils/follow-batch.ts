import { KycVerificationStatus, PrismaClient } from '@prisma/client';

type PrismaLike = Pick<PrismaClient, 'hostFollower' | 'hostKyc'>;

const ACTIVE = { deletedAt: null } as const;

export async function batchFollowerCounts(prisma: PrismaLike, hostIds: string[]) {
  if (hostIds.length === 0) return new Map<string, number>();
  const rows = await prisma.hostFollower.groupBy({
    by: ['hostId'],
    where: { hostId: { in: hostIds }, ...ACTIVE },
    _count: true,
  });
  return new Map(rows.map((r) => [r.hostId, r._count]));
}

export async function batchFollowingSet(
  prisma: PrismaLike,
  userId: string,
  hostIds: string[],
) {
  if (hostIds.length === 0) return new Set<string>();
  const rows = await prisma.hostFollower.findMany({
    where: { userId, hostId: { in: hostIds }, ...ACTIVE },
    select: { hostId: true },
  });
  return new Set(rows.map((r) => r.hostId));
}

export async function batchVerifiedHosts(prisma: PrismaLike, hostIds: string[]) {
  if (hostIds.length === 0) return new Set<string>();
  const rows = await prisma.hostKyc.findMany({
    where: {
      userId: { in: hostIds },
      verificationStatus: KycVerificationStatus.verified,
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  return new Set(rows.map((r) => r.userId));
}

export async function singleFollowerCount(prisma: PrismaLike, hostId: string) {
  return prisma.hostFollower.count({ where: { hostId, ...ACTIVE } });
}

export async function isUserFollowing(prisma: PrismaLike, userId: string, hostId: string) {
  const row = await prisma.hostFollower.findFirst({
    where: { userId, hostId, ...ACTIVE },
    select: { id: true },
  });
  return Boolean(row);
}