import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../../common/exceptions/business.exception';
import {
  AVATAR_EMOTION_EXPRESSIONS,
  CALL_EVENT_REACTIONS,
  defaultAvatarAnimationConfig,
  GIFT_CATEGORY_REACTIONS,
  IDLE_ANIMATION_CATALOG,
  type AvatarAnimationConfig,
} from '../../../common/utils/avatar-engine';
import { parseJsonField, type VirtualHostAvatarConfig } from '../../../common/utils/virtual-host';
import { PrismaService } from '../../../database/prisma.service';
import type { AvatarConfigDto } from './dto/avatar-config.dto';

@Injectable()
export class AiAvatarService {
  constructor(private readonly prisma: PrismaService) {}

  getCatalog() {
    return {
      emotions: Object.values(AVATAR_EMOTION_EXPRESSIONS).map((e) => ({
        id: e.id,
        label: e.label,
      })),
      idleAnimations: IDLE_ANIMATION_CATALOG.map((a) => ({
        id: a.id,
        weight: a.weight,
        durationMs: a.durationMs,
      })),
      giftReactions: GIFT_CATEGORY_REACTIONS,
      callEventReactions: CALL_EVENT_REACTIONS,
      defaults: defaultAvatarAnimationConfig(),
    };
  }

  async adminUpdateAvatarConfig(hostId: string, dto: AvatarConfigDto) {
    const profile = await this.prisma.hostProfile.findFirst({
      where: { userId: hostId, profileType: { in: ['MANAGED_HOST', 'AI_HOST'] } },
    });
    if (!profile) {
      throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');
    }

    const current = parseJsonField<VirtualHostAvatarConfig>(profile.virtualHostAvatar, {});
    const animation = parseJsonField<AvatarAnimationConfig>(
      current as AvatarAnimationConfig,
      defaultAvatarAnimationConfig(),
    );
    const merged: VirtualHostAvatarConfig = {
      ...current,
      ...animation,
      ...dto,
    };

    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: { virtualHostAvatar: merged },
    });

    return { hostId, avatar: merged };
  }

  previewConfig(hostId: string | undefined, overrides?: AvatarConfigDto) {
    const base = defaultAvatarAnimationConfig();
    return {
      hostId: hostId ?? null,
      avatar: { ...base, ...overrides },
      sampleEmotions: ['happy', 'excited', 'thinking', 'flirty', 'surprised'],
      performance: {
        targetFps: 60,
        rendering: 'css-transform',
        gpuAccelerated: true,
      },
    };
  }
}