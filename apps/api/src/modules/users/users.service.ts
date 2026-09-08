import { Injectable } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import {
  canReceiveCalls,
  formatLastSeenLabel,
  resolveHostStatus,
} from '../../common/utils/host-status';
import { isUserFollowing, singleFollowerCount } from '../../common/utils/follow-batch';
import { fetchPublicHostStats } from '../../common/utils/host-public-stats';
import { PrismaService } from '../../database/prisma.service';

function parseVirtualHostGalleryUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { url: string } =>
        !!item && typeof item === 'object' && 'url' in item && typeof item.url === 'string',
    )
    .map((item) => item.url);
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findFirst({
      where: { firebaseUid, deletedAt: null },
    });
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, revokedAt: null },
      select: { role: true },
    });
    return assignments.map((a) => a.role);
  }

  async assignRole(userId: string, role: Role, grantedById?: string) {
    return this.prisma.userRole.upsert({
      where: { userId_role: { userId, role } },
      update: { revokedAt: null, grantedById: grantedById ?? null },
      create: { userId, role, grantedById },
    });
  }

  async revokeRole(userId: string, role: Role) {
    return this.prisma.userRole.updateMany({
      where: { userId, role, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updateStatus(userId: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  async softDelete(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), status: UserStatus.deleted },
    });
  }

  async getPublicProfile(viewerId: string, targetId: string) {
    const blocked = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: targetId },
          { blockerId: targetId, blockedId: viewerId },
        ],
      },
    });

    if (blocked) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null, status: UserStatus.active },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        gender: true,
        primaryLanguage: true,
        communityWarningVisible: true,
        hostProfile: {
          select: {
            isAvailable: true,
            isOnline: true,
            isBusy: true,
            lastSeenAt: true,
            hostBio: true,
            languages: true,
            totalCalls: true,
            ratingSum: true,
            ratingCount: true,
            approvedAt: true,
            createdAt: true,
            virtualHostGallery: true,
          },
        },
      },
    });

    if (!user) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.hostProfile) {
      const status = resolveHostStatus(user.hostProfile.isOnline, user.hostProfile.isBusy);
      const galleryUrls = parseVirtualHostGalleryUrls(user.hostProfile.virtualHostGallery);
      const [ratingStats, followerCount, isFollowing] = await Promise.all([
        fetchPublicHostStats(this.prisma, targetId),
        singleFollowerCount(this.prisma, targetId),
        isUserFollowing(this.prisma, viewerId, targetId),
      ]);
      return {
        ...user,
        hostProfile: {
          ...user.hostProfile,
          virtualHostGallery: galleryUrls,
          status,
          lastSeenLabel: formatLastSeenLabel(
            user.hostProfile.lastSeenAt,
            user.hostProfile.isOnline,
            user.hostProfile.isBusy,
          ),
          canReceiveCalls: canReceiveCalls(user.hostProfile.isOnline, user.hostProfile.isBusy),
          isAvailable: canReceiveCalls(user.hostProfile.isOnline, user.hostProfile.isBusy),
          rating:
            user.hostProfile.ratingCount > 0
              ? user.hostProfile.ratingSum / user.hostProfile.ratingCount
              : null,
        },
        ratingStats,
        followStats: { followerCount, isFollowing },
      };
    }

    return user;
  }
}