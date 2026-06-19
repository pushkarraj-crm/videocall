import { Injectable } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';

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
        hostProfile: {
          select: {
            isAvailable: true,
            hostBio: true,
            languages: true,
            totalCalls: true,
            ratingSum: true,
            ratingCount: true,
          },
        },
      },
    });

    if (!user) {
      throw new BusinessException('User not found', 404, 'USER_NOT_FOUND');
    }

    return user;
  }
}