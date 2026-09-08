import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../../common/exceptions/business.exception';
import {
  CAMERA_FRAMING,
  defaultVideoAvatarConfig,
  defaultWardrobeConfig,
  VIDEO_POSES,
  WARDROBE_CATEGORIES,
  type VirtualHostVideoConfig,
  type VirtualHostWardrobeConfig,
} from '../../../common/utils/video-avatar-engine';
import { parseJsonField } from '../../../common/utils/virtual-host';
import { PrismaService } from '../../../database/prisma.service';
import type { VideoConfigDto } from './dto/video-config.dto';
import type { WardrobeConfigDto } from './dto/wardrobe.dto';

@Injectable()
export class AiVideoAvatarService {
  constructor(private readonly prisma: PrismaService) {}

  getCatalog() {
    return {
      poses: VIDEO_POSES,
      wardrobeCategories: WARDROBE_CATEGORIES,
      cameraModes: Object.keys(CAMERA_FRAMING),
      defaults: defaultVideoAvatarConfig(),
      performance: {
        targetFps: 60,
        rendering: 'gpu-css-video-composite',
        lazyAssets: true,
        nonBlocking: true,
      },
    };
  }

  async adminUpdateVideoConfig(hostId: string, dto: VideoConfigDto) {
    const profile = await this.requireVirtualHost(hostId);
    const current = parseJsonField<VirtualHostVideoConfig>(
      profile.virtualHostVideo,
      defaultVideoAvatarConfig(),
    );
    const merged = { ...current, ...dto };
    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: { virtualHostVideo: merged },
    });
    return { hostId, video: merged };
  }

  async adminUpdateWardrobe(hostId: string, dto: WardrobeConfigDto) {
    const profile = await this.requireVirtualHost(hostId);
    const current = parseJsonField<VirtualHostWardrobeConfig>(
      profile.virtualHostWardrobe,
      defaultWardrobeConfig(),
    );
    const merged: VirtualHostWardrobeConfig = {
      ...current,
      ...dto,
      outfits: dto.outfits ?? current.outfits,
    };
    if (merged.activeOutfitId && merged.outfits?.length) {
      const active = merged.outfits.find((o) => o.id === merged.activeOutfitId);
      if (!active?.approved) {
        throw new BusinessException('Active outfit not approved', 400, 'OUTFIT_NOT_APPROVED');
      }
    }
    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: { virtualHostWardrobe: merged },
    });
    return { hostId, wardrobe: merged };
  }

  async adminSetActiveOutfit(hostId: string, outfitId: string) {
    const profile = await this.requireVirtualHost(hostId);
    const wardrobe = parseJsonField<VirtualHostWardrobeConfig>(
      profile.virtualHostWardrobe,
      defaultWardrobeConfig(),
    );
    const outfit = wardrobe.outfits?.find((o) => o.id === outfitId);
    if (!outfit) throw new BusinessException('Outfit not found', 404, 'OUTFIT_NOT_FOUND');
    if (!outfit.approved) {
      throw new BusinessException('Outfit not approved', 400, 'OUTFIT_NOT_APPROVED');
    }
    wardrobe.activeOutfitId = outfitId;
    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: { virtualHostWardrobe: wardrobe },
    });
    return { hostId, activeOutfitId: outfitId, outfit };
  }

  preview(hostId?: string, overrides?: VideoConfigDto) {
    return {
      hostId: hostId ?? null,
      video: { ...defaultVideoAvatarConfig(), ...overrides },
      sync: ['conversation', 'voice', 'emotion', 'gifts'],
      performance: this.getCatalog().performance,
    };
  }

  private async requireVirtualHost(hostId: string) {
    const profile = await this.prisma.hostProfile.findFirst({
      where: { userId: hostId, profileType: { in: ['MANAGED_HOST', 'AI_HOST'] } },
    });
    if (!profile) {
      throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');
    }
    return profile;
  }
}