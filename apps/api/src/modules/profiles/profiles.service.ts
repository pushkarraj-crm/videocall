import { Injectable } from '@nestjs/common';
import { ModerationTargetType, ModerationQueueStatus } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const FLAGGED_KEYWORDS = ['escort', 'nude', 'explicit', 'adult only'];

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private scanContent(text: string): string | null {
    const lower = text.toLowerCase();
    for (const word of FLAGGED_KEYWORDS) {
      if (lower.includes(word)) return word;
    }
    return null;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.bio) {
      const flagged = this.scanContent(dto.bio);
      if (flagged) {
        await this.prisma.moderationQueue.create({
          data: {
            targetType: ModerationTargetType.bio,
            targetId: userId,
            userId,
            status: ModerationQueueStatus.pending,
            priority: 3,
            autoFlagReason: `keyword:${flagged}`,
          },
        });
        throw new BusinessException(
          'Bio contains prohibited content and is pending review',
          400,
          'CONTENT_FLAGGED',
        );
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        gender: dto.gender,
        primaryLanguage: dto.primaryLanguage,
        avatarUrl: dto.avatarUrl,
      },
      select: {
        id: true,
        displayName: true,
        bio: true,
        gender: true,
        primaryLanguage: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });
  }

  async getConsents(userId: string) {
    return this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { consentedAt: 'desc' },
    });
  }
}