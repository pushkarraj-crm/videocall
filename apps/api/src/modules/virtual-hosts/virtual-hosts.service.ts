import { Injectable, Logger } from '@nestjs/common';
import {
  CallStatus,
  ConsentDocumentType,
  Gender,
  HostProfileType,
  Prisma,
  Role,
  UserStatus,
  VirtualHostStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { coinsToUnits, unitsToCoins } from '../../common/constants/coins';
import { unitsToCoinsPerMinute } from '../../common/utils/coin-pricing';
import { BusinessException } from '../../common/exceptions/business.exception';
import { generateReferralCode } from '../../common/utils/referral-code.util';
import { defaultConversationConfig } from '../../common/utils/conversation-engine';
import { defaultAvatarAnimationConfig } from '../../common/utils/avatar-engine';
import {
  defaultVideoAvatarConfig,
  defaultWardrobeConfig,
} from '../../common/utils/video-avatar-engine';
import {
  buildConversationSummary,
  buildPersonalitySnapshot,
  canVirtualHostReceiveCall,
  DEFAULT_GIFT_REACTIONS,
  generateSessionId,
  isVirtualHostDiscoverable,
  isVirtualHostProfile,
  parseJsonField,
  syncVirtualHostAvailability,
  VirtualHostAvatarConfig,
  VirtualHostGiftReaction,
  VirtualHostPersonalityConfig,
  VirtualHostVoiceConfig,
} from '../../common/utils/virtual-host';
import {
  AiHostAssetsService,
  type GalleryImage,
} from '../../integrations/ai-host-assets/ai-host-assets.service';
import { AiVideoCatalogService } from '../../integrations/ai-host-assets/ai-video-catalog.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateVirtualHostDto } from './dto/create-virtual-host.dto';
import { UpdateVirtualHostDto } from './dto/update-virtual-host.dto';

function ageToDateOfBirth(age: number): Date {
  const year = new Date().getFullYear() - age;
  return new Date(`${year}-06-15`);
}

function parseGallery(value: unknown): GalleryImage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && 'url' in item) as GalleryImage[];
}

type HostProfileRow = Prisma.HostProfileGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        displayName: true;
        avatarUrl: true;
        bio: true;
        gender: true;
        primaryLanguage: true;
      };
    };
  };
}>;

@Injectable()
export class VirtualHostsService {
  private readonly logger = new Logger(VirtualHostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AiHostAssetsService,
    private readonly videoCatalog: AiVideoCatalogService,
  ) {}

  serializeForDiscover(
    host: HostProfileRow & {
      virtualHostGallery?: unknown;
      virtualHostAssetSlug?: string | null;
      user: HostProfileRow['user'] & { dateOfBirth?: Date };
    },
  ) {
    const gallery = parseGallery(host.virtualHostGallery).map((g) => g.url);
    const age = host.user.dateOfBirth
      ? Math.floor(
          (Date.now() - new Date(host.user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
        )
      : null;
    return {
      profileType: host.profileType,
      virtualHostRegion: host.virtualHostRegion,
      virtualHostLanguage: host.virtualHostLanguage,
      virtualHostPriority: host.virtualHostPriority,
      virtualHostPopularity: host.virtualHostPopularity,
      virtualHostGallery: gallery,
      virtualHostAssetSlug: host.virtualHostAssetSlug,
      age,
    };
  }

  serializeVirtualHostMeta(
    profile: Pick<
      HostProfileRow,
      | 'profileType'
      | 'virtualHostGreeting'
      | 'virtualHostAvatar'
      | 'virtualHostPersonality'
      | 'virtualHostVoice'
      | 'virtualHostLanguage'
      | 'virtualHostGiftReactions'
      | 'virtualHostVideo'
      | 'virtualHostWardrobe'
      | 'user'
    >,
  ) {
    const avatar = {
      ...defaultAvatarAnimationConfig(),
      ...parseJsonField<VirtualHostAvatarConfig>(profile.virtualHostAvatar, {}),
    };
    const personality = parseJsonField<VirtualHostPersonalityConfig>(
      profile.virtualHostPersonality,
      {},
    );
    const voice = parseJsonField<VirtualHostVoiceConfig>(profile.virtualHostVoice, {});
    const video = {
      ...defaultVideoAvatarConfig(),
      ...parseJsonField(profile.virtualHostVideo, {}),
      assetSlug:
        (profile as { virtualHostAssetSlug?: string | null }).virtualHostAssetSlug ??
        parseJsonField<{ assetSlug?: string }>(profile.virtualHostVideo, {}).assetSlug,
    };
    const wardrobe = {
      ...defaultWardrobeConfig(avatar.imageUrl ?? profile.user.avatarUrl ?? undefined),
      ...parseJsonField(profile.virtualHostWardrobe, {}),
    };
    const activeOutfit = wardrobe.outfits?.find((o) => o.id === wardrobe.activeOutfitId);

    return {
      profileType: profile.profileType,
      isVirtualHost: isVirtualHostProfile(profile as HostProfileRow),
      displayName: profile.user.displayName,
      greeting:
        profile.virtualHostGreeting ??
        personality.greeting ??
        `Hi! I'm ${profile.user.displayName}. So glad you're here!`,
      avatar: {
        imageUrl: avatar.imageUrl ?? profile.user.avatarUrl,
        idleAnimation: avatar.idleAnimation ?? avatar.defaultIdleAnimation ?? 'breathe',
        talkAnimation: avatar.talkAnimation ?? 'talk_nod',
        smileAnimation: avatar.smileAnimation ?? 'smile_soft',
        giftReactionAnimation: avatar.giftReactionAnimation ?? 'gift_sparkle',
        callEndAnimation: avatar.callEndAnimation ?? 'wave_goodbye',
        typingAnimation: avatar.typingAnimation ?? 'typing_dots',
        defaultIdleAnimation: avatar.defaultIdleAnimation ?? 'breathe',
        expressionIntensity: avatar.expressionIntensity ?? 0.7,
        blinkFrequency: avatar.blinkFrequency ?? 'medium',
        headMovement: avatar.headMovement ?? 'normal',
        reactionsEnabled: avatar.reactionsEnabled ?? true,
        lipSyncIntensity: avatar.lipSyncIntensity ?? 0.75,
        idleSchedulerEnabled: avatar.idleSchedulerEnabled ?? true,
        minAnimationCooldownMs: avatar.minAnimationCooldownMs ?? 2800,
      },
      personality,
      voice,
      video,
      wardrobe,
      activeOutfit,
      language: profile.virtualHostLanguage ?? personality.language ?? voice.language ?? 'en',
    };
  }

  async assertCanReceiveCall(hostProfile: HostProfileRow) {
    if (!isVirtualHostProfile(hostProfile)) return false;
    if (!canVirtualHostReceiveCall(hostProfile)) {
      if (hostProfile.virtualHostStatus === 'BUSY' || hostProfile.isBusy) {
        throw new BusinessException('Host is on another call', 400, 'HOST_BUSY');
      }
      throw new BusinessException('Host is currently offline', 400, 'HOST_OFFLINE');
    }
    return true;
  }

  async createSession(callId: string, userId: string, hostId: string) {
    const profile = await this.prisma.hostProfile.findUniqueOrThrow({
      where: { userId: hostId },
    });

    if (!isVirtualHostProfile(profile)) {
      throw new BusinessException('Not a virtual host', 400, 'NOT_VIRTUAL_HOST');
    }

    const sessionId = generateSessionId(callId);

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualHostSession.create({
        data: {
          sessionId,
          callId,
          userId,
          hostId,
          profileType: profile.profileType,
          personalitySnapshot: buildPersonalitySnapshot(profile),
        },
      });

      if (profile.profileType === 'REAL_HOST') {
        await tx.hostProfile.update({
          where: { userId: hostId },
          data: syncVirtualHostAvailability('BUSY'),
        });
      }
    });

    this.logger.log(
      JSON.stringify({ event: 'VIRTUAL_HOST_SESSION_STARTED', callId, hostId, sessionId }),
    );

    return { sessionId, profileType: profile.profileType };
  }

  async handleCallerConsent(
    callId: string,
    documentVersion: string,
    ip?: string,
    acceptCall?: (callId: string, hostId: string) => Promise<unknown>,
  ) {
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });
    const profile = await this.prisma.hostProfile.findUniqueOrThrow({
      where: { userId: call.calleeId },
    });

    if (!isVirtualHostProfile(profile)) return { autoAccepted: false };

    await this.prisma.callConsent.upsert({
      where: { callId_userId: { callId, userId: call.calleeId } },
      update: { documentVersion, ipAddress: ip ?? null },
      create: {
        callId,
        userId: call.calleeId,
        documentVersion,
        ipAddress: ip ?? null,
      },
    });

    await this.prisma.userConsent.create({
      data: {
        userId: call.calleeId,
        documentType: ConsentDocumentType.pre_call,
        documentVersion,
        ipAddress: ip ?? null,
      },
    });

    if (acceptCall) {
      await acceptCall(callId, call.calleeId);
    }

    return { autoAccepted: true };
  }

  async finalizeSession(callId: string, call: {
    callerId: string;
    calleeId: string;
    durationSeconds: number;
    coinsChargedUnits: bigint;
    startedAt: Date | null;
  }) {
    const session = await this.prisma.virtualHostSession.findUnique({
      where: { callId },
      include: {
        host: { include: { user: { select: { displayName: true } } } },
      },
    });

    if (!session) return null;

    const giftCount = await this.prisma.callGift.count({ where: { callId } });

    const memory = await this.prisma.virtualHostMemory.upsert({
      where: { userId_hostId: { userId: session.userId, hostId: session.hostId } },
      create: {
        userId: session.userId,
        hostId: session.hostId,
        callCount: 1,
        friendshipScore: 5,
        lastConversationAt: new Date(),
      },
      update: {
        callCount: { increment: 1 },
        friendshipScore: { increment: 5 },
        lastConversationAt: new Date(),
      },
    });

    const personality = parseJsonField<VirtualHostPersonalityConfig>(
      session.personalitySnapshot,
      {},
    );
    const style =
      typeof personality === 'object' && personality && 'personality' in personality
        ? (personality.personality as VirtualHostPersonalityConfig)?.style
        : (personality as VirtualHostPersonalityConfig)?.style;

    const summary = buildConversationSummary({
      hostName: session.host.user.displayName,
      durationSeconds: call.durationSeconds,
      giftsReceived: giftCount,
      personality: style,
      callCount: memory.callCount,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.virtualHostSession.update({
        where: { id: session.id },
        data: {
          endedAt: new Date(),
          durationSeconds: call.durationSeconds,
          coinsSpentUnits: call.coinsChargedUnits,
          giftsReceivedCount: giftCount,
          conversationSummary: summary,
        },
      });

      const hostProfile = await tx.hostProfile.findUnique({
        where: { userId: session.hostId },
        select: { virtualHostEnabled: true, profileType: true },
      });

      if (hostProfile && isVirtualHostProfile(hostProfile)) {
        await tx.hostProfile.update({
          where: { userId: session.hostId },
          data: syncVirtualHostAvailability('ONLINE'),
        });
      }
    });

    this.logger.log(
      JSON.stringify({
        event: 'VIRTUAL_HOST_SESSION_ENDED',
        callId,
        durationSeconds: call.durationSeconds,
        giftsReceived: giftCount,
      }),
    );

    return { sessionId: session.sessionId, conversationSummary: summary };
  }

  getGiftReaction(
    profile: Pick<HostProfileRow, 'virtualHostGiftReactions'>,
    giftSlug: string,
  ): VirtualHostGiftReaction {
    const custom = parseJsonField<Record<string, VirtualHostGiftReaction>>(
      profile.virtualHostGiftReactions,
      {},
    );
    return custom[giftSlug] ?? DEFAULT_GIFT_REACTIONS[giftSlug] ?? { message: 'Thank you!', animation: 'smile' };
  }

  async recordGiftInSession(callId: string) {
    await this.prisma.virtualHostSession.updateMany({
      where: { callId, endedAt: null },
      data: { giftsReceivedCount: { increment: 1 } },
    });
  }

  async getSessionForCall(callId: string, userId: string) {
    const session = await this.prisma.virtualHostSession.findUnique({
      where: { callId },
      include: {
        host: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                bio: true,
                gender: true,
                primaryLanguage: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new BusinessException('Virtual session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (session.userId !== userId && session.hostId !== userId) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
    }

    const memory =
      session.userId === userId
        ? await this.prisma.virtualHostMemory.findUnique({
            where: { userId_hostId: { userId: session.userId, hostId: session.hostId } },
          })
        : null;

    return {
      sessionId: session.sessionId,
      callId: session.callId,
      profileType: session.profileType,
      startedAt: session.startedAt,
      virtualHost: this.serializeVirtualHostMeta(session.host),
      memory: memory
        ? {
            nickname: memory.nickname,
            preferredLanguage: memory.preferredLanguage,
            favoriteTopics: memory.favoriteTopics,
            friendshipScore: memory.friendshipScore,
            callCount: memory.callCount,
            conversationHistory: memory.conversationHistory,
            lastCallSummary: memory.lastCallSummary,
          }
        : null,
    };
  }

  async getMemory(userId: string, hostId: string) {
    const memory = await this.prisma.virtualHostMemory.findUnique({
      where: { userId_hostId: { userId, hostId } },
    });
    if (!memory) {
      return {
        nickname: null,
        preferredLanguage: null,
        favoriteTopics: [],
        friendshipScore: 0,
        callCount: 0,
        favoriteVirtualHostIds: [],
        conversationHistory: [],
        lastCallSummary: null,
      };
    }
    return {
      nickname: memory.nickname,
      preferredLanguage: memory.preferredLanguage,
      favoriteTopics: memory.favoriteTopics,
      giftHistorySummary: memory.giftHistorySummary,
      friendshipScore: memory.friendshipScore,
      callCount: memory.callCount,
      favoriteVirtualHostIds: memory.favoriteVirtualHostIds,
      lastConversationAt: memory.lastConversationAt,
      conversationHistory: memory.conversationHistory,
      lastCallSummary: memory.lastCallSummary,
    };
  }

  buildDiscoverWhere(): Prisma.HostProfileWhereInput {
    return {
      adminCallsDisabled: false,
      user: { deletedAt: null, status: UserStatus.active },
      OR: [
        { isOnline: true, profileType: 'REAL_HOST' },
        {
          profileType: { in: ['MANAGED_HOST', 'AI_HOST'] },
          virtualHostEnabled: true,
          virtualHostStatus: 'ONLINE',
          isOnline: true,
        },
      ],
    };
  }

  isDiscoverable(profile: HostProfileRow): boolean {
    if (profile.profileType === 'REAL_HOST') {
      return profile.isOnline && !profile.adminCallsDisabled;
    }
    return isVirtualHostDiscoverable(profile);
  }

  // --- Admin CRUD ---

  async adminList() {
    const hosts = await this.prisma.hostProfile.findMany({
      where: {
        profileType: 'AI_HOST',
        user: { deletedAt: null },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            gender: true,
            primaryLanguage: true,
            status: true,
            dateOfBirth: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ virtualHostPriority: 'desc' }, { createdAt: 'desc' }],
    });

    return hosts.map((h) => this.serializeAdminHost(h));
  }

  async adminGet(hostId: string) {
    const host = await this.prisma.hostProfile.findFirst({
      where: { userId: hostId, profileType: { in: ['MANAGED_HOST', 'AI_HOST'] } },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            gender: true,
            primaryLanguage: true,
            status: true,
            dateOfBirth: true,
            createdAt: true,
          },
        },
      },
    });

    if (!host) {
      throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');
    }

    return this.serializeAdminHost(host);
  }

  async adminCreate(dto: CreateVirtualHostDto) {
    if (dto.profileType === 'REAL_HOST') {
      throw new BusinessException('Use REAL_HOST only for live hosts', 400, 'INVALID_PROFILE_TYPE');
    }

    const existingSlugs = await this.prisma.hostProfile.findMany({
      where: { virtualHostAssetSlug: { not: null } },
      select: { virtualHostAssetSlug: true },
    });
    const taken = new Set(
      existingSlugs.map((s) => s.virtualHostAssetSlug).filter(Boolean) as string[],
    );
    const baseSlug = this.assets.generateAssetSlug(dto.hostName ?? dto.displayName);
    const assetSlug = this.assets.ensureUniqueSlug(baseSlug, taken);

    const authIdentity = `virtual_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const enabled = dto.virtualHostEnabled !== false;
    const status: VirtualHostStatus =
      dto.virtualHostStatus ?? (enabled ? 'ONLINE' : 'OFFLINE');
    const avail = syncVirtualHostAvailability(status);
    const languages = dto.languages?.length
      ? dto.languages
      : dto.primaryLanguage
        ? [dto.primaryLanguage]
        : ['en'];
    const country = dto.country ?? dto.virtualHostRegion ?? 'IN';

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          authIdentity,
          displayName: dto.displayName,
          avatarUrl: dto.avatarUrl ?? null,
          bio: dto.bio ?? null,
          gender: dto.gender ?? Gender.female,
          primaryLanguage: languages[0] ?? 'en',
          dateOfBirth: dto.age ? ageToDateOfBirth(dto.age) : new Date('1998-01-01'),
          referralCode: generateReferralCode(),
        },
      });

      await tx.userRole.create({ data: { userId: created.id, role: Role.host } });
      await tx.wallet.create({ data: { userId: created.id } });

      await tx.hostProfile.create({
        data: {
          userId: created.id,
          approvedAt: new Date(),
          profileType: dto.profileType,
          virtualHostEnabled: enabled,
          virtualHostPriority: dto.virtualHostPriority ?? 50,
          virtualHostPopularity: dto.virtualHostPopularity ?? 0,
          virtualHostLanguage: dto.virtualHostLanguage ?? languages[0] ?? 'en',
          virtualHostRegion: country,
          virtualHostGreeting: dto.virtualHostGreeting ?? null,
          virtualHostUsername: dto.virtualHostUsername ?? null,
          virtualHostAssetSlug: assetSlug,
          virtualHostGallery: [] as Prisma.InputJsonValue,
          virtualHostVoice: (dto.virtualHostVoice ?? {
            provider: 'default',
            voiceId: 'warm_female_1',
            speed: 1,
            pitch: 1,
            emotion: 'friendly',
            language: dto.virtualHostLanguage ?? languages[0] ?? 'en',
            streamingEnabled: true,
          }) as Prisma.InputJsonValue,
          virtualHostConversation: (dto.virtualHostConversation ??
            defaultConversationConfig()) as Prisma.InputJsonValue,
          virtualHostAvatar: (dto.virtualHostAvatar ?? {
            imageUrl: dto.avatarUrl,
            idleAnimation: 'idle_breathe',
            talkAnimation: 'talk_nod',
            smileAnimation: 'smile_soft',
            giftReactionAnimation: 'gift_sparkle',
            callEndAnimation: 'wave_goodbye',
            typingAnimation: 'typing_dots',
          }) as Prisma.InputJsonValue,
          virtualHostVideo: {
            ...defaultVideoAvatarConfig(),
            assetSlug,
            sceneSlug: 'bedroom',
          } as Prisma.InputJsonValue,
          virtualHostWardrobe: defaultWardrobeConfig(dto.avatarUrl ?? undefined) as Prisma.InputJsonValue,
          virtualHostPersonality: (dto.virtualHostPersonality ?? {
            style: 'Friendly',
            responseStyle: 'warm',
            emojiUsage: 'medium',
            speakingSpeed: 'normal',
            hostName: dto.hostName ?? dto.displayName,
          }) as Prisma.InputJsonValue,
          virtualHostGiftReactions: (dto.virtualHostGiftReactions ??
            DEFAULT_GIFT_REACTIONS) as Prisma.InputJsonValue,
          virtualHostSchedule: (dto.virtualHostSchedule ?? { timezone: 'Asia/Kolkata', alwaysOn: true }) as Prisma.InputJsonValue,
          adminWithdrawalsDisabled: true,
          hostBio: dto.bio,
          languages,
          ...avail,
        },
      });

      return created;
    });

    this.assets.scaffoldHostFolders(assetSlug);
    this.assets.scanAndWriteManifest();
    this.videoCatalog.refresh();

    return this.adminGet(user.id);
  }

  async adminUpdate(hostId: string, dto: UpdateVirtualHostDto) {
    const existing = await this.prisma.hostProfile.findFirst({
      where: { userId: hostId, profileType: { in: ['MANAGED_HOST', 'AI_HOST'] } },
    });

    if (!existing) {
      throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');
    }

    if (dto.profileType === 'REAL_HOST') {
      throw new BusinessException('Cannot downgrade to REAL_HOST here', 400, 'INVALID_PROFILE_TYPE');
    }

    const statusUpdate = dto.virtualHostStatus
      ? syncVirtualHostAvailability(dto.virtualHostStatus)
      : dto.virtualHostEnabled === false
        ? syncVirtualHostAvailability('OFFLINE')
        : dto.virtualHostEnabled === true && !existing.virtualHostStatus
          ? syncVirtualHostAvailability('ONLINE')
          : {};

    await this.prisma.$transaction(async (tx) => {
      if (
        dto.displayName ||
        dto.avatarUrl !== undefined ||
        dto.bio !== undefined ||
        dto.gender ||
        dto.primaryLanguage ||
        dto.age !== undefined
      ) {
        await tx.user.update({
          where: { id: hostId },
          data: {
            ...(dto.displayName ? { displayName: dto.displayName } : {}),
            ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
            ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
            ...(dto.gender ? { gender: dto.gender } : {}),
            ...(dto.primaryLanguage ? { primaryLanguage: dto.primaryLanguage } : {}),
            ...(dto.age !== undefined ? { dateOfBirth: ageToDateOfBirth(dto.age) } : {}),
          },
        });
      }

      await tx.hostProfile.update({
        where: { userId: hostId },
        data: {
          ...(dto.virtualHostUsername !== undefined
            ? { virtualHostUsername: dto.virtualHostUsername }
            : {}),
          ...(dto.country !== undefined ? { virtualHostRegion: dto.country } : {}),
          ...(dto.languages !== undefined ? { languages: dto.languages } : {}),
          ...(dto.virtualHostGallery !== undefined
            ? { virtualHostGallery: dto.virtualHostGallery as Prisma.InputJsonValue }
            : {}),
          ...(dto.profileType ? { profileType: dto.profileType } : {}),
          ...(dto.virtualHostEnabled !== undefined
            ? { virtualHostEnabled: dto.virtualHostEnabled }
            : {}),
          ...(dto.virtualHostPriority !== undefined
            ? { virtualHostPriority: dto.virtualHostPriority }
            : {}),
          ...(dto.virtualHostPopularity !== undefined
            ? { virtualHostPopularity: dto.virtualHostPopularity }
            : {}),
          ...(dto.virtualHostLanguage !== undefined
            ? { virtualHostLanguage: dto.virtualHostLanguage }
            : {}),
          ...(dto.virtualHostRegion !== undefined
            ? { virtualHostRegion: dto.virtualHostRegion }
            : {}),
          ...(dto.virtualHostGreeting !== undefined
            ? { virtualHostGreeting: dto.virtualHostGreeting }
            : {}),
          ...(dto.virtualHostVoice !== undefined
            ? { virtualHostVoice: dto.virtualHostVoice as Prisma.InputJsonValue }
            : {}),
          ...(dto.virtualHostAvatar !== undefined
            ? { virtualHostAvatar: dto.virtualHostAvatar as Prisma.InputJsonValue }
            : {}),
          ...(dto.virtualHostPersonality !== undefined
            ? { virtualHostPersonality: dto.virtualHostPersonality as Prisma.InputJsonValue }
            : {}),
          ...(dto.virtualHostGiftReactions !== undefined
            ? { virtualHostGiftReactions: dto.virtualHostGiftReactions as Prisma.InputJsonValue }
            : {}),
          ...(dto.virtualHostSchedule !== undefined
            ? { virtualHostSchedule: dto.virtualHostSchedule as Prisma.InputJsonValue }
            : {}),
          ...(dto.virtualHostConversation !== undefined
            ? { virtualHostConversation: dto.virtualHostConversation as Prisma.InputJsonValue }
            : {}),
          ...(dto.bio !== undefined ? { hostBio: dto.bio } : {}),
          ...(dto.coinsPerMinute !== undefined
            ? { coinsPerMinuteUnits: coinsToUnits(dto.coinsPerMinute) }
            : {}),
          ...statusUpdate,
        },
      });
    });

    return this.adminGet(hostId);
  }

  async adminDelete(hostId: string) {
    const existing = await this.prisma.hostProfile.findFirst({
      where: {
        userId: hostId,
        profileType: { in: ['MANAGED_HOST', 'AI_HOST'] },
        user: { deletedAt: null },
      },
    });

    if (!existing) {
      throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');
    }

    const activeCalls = await this.prisma.call.count({
      where: {
        calleeId: hostId,
        status: { in: [CallStatus.initiated, CallStatus.active] },
      },
    });
    if (activeCalls > 0) {
      throw new BusinessException(
        'Cannot delete host while they have an active call',
        409,
        'HOST_HAS_ACTIVE_CALLS',
      );
    }

    const assetSlug = existing.virtualHostAssetSlug;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.callRoutingSettings.updateMany({
          where: { defaultAiHostId: hostId },
          data: { defaultAiHostId: null },
        });

        await tx.virtualHostConversationTurn.deleteMany({ where: { hostId } });
        await tx.virtualHostVoiceSession.deleteMany({ where: { hostId } });
        await tx.virtualHostSession.deleteMany({ where: { hostId } });
        await tx.virtualHostMemory.deleteMany({ where: { hostId } });
        await tx.aIHostMemory.deleteMany({ where: { hostId } });
        await tx.conversationHistory.deleteMany({ where: { hostId } });
        await tx.hostFollower.deleteMany({ where: { hostId } });

        await tx.hostProfile.delete({ where: { userId: hostId } });

        await tx.user.update({
          where: { id: hostId },
          data: { deletedAt: new Date(), status: UserStatus.deleted },
        });
      });
    } catch (err) {
      this.logger.error(`AI host delete failed for ${hostId}`, err);
      const message =
        err instanceof Error ? err.message : 'Failed to delete AI host';
      throw new BusinessException(message, 500, 'AI_HOST_DELETE_FAILED');
    }

    if (assetSlug) {
      try {
        this.assets.removeHostAssets(assetSlug);
      } catch (err) {
        this.logger.warn(`Asset cleanup failed for slug ${assetSlug}: ${err}`);
      }
      this.videoCatalog.refresh();
    }

    this.logger.log(JSON.stringify({ event: 'AI_HOST_DELETED', hostId, assetSlug }));
    return { deleted: true, hostId };
  }

  async adminGetAssets(hostId: string) {
    const host = await this.requireAiHost(hostId);
    const slug = host.virtualHostAssetSlug;
    if (!slug) {
      return { assetSlug: null, videoCount: 0, videos: [], galleryCount: 0, gallery: [] };
    }
    const summary = this.assets.getAssetSummary(slug);
    const gallery = parseGallery(host.virtualHostGallery);
    return { ...summary, gallery };
  }

  async adminUploadVideo(hostId: string, buffer: Buffer, originalName?: string) {
    const host = await this.requireAiHost(hostId);
    const slug = host.virtualHostAssetSlug;
    if (!slug) {
      throw new BusinessException('Host has no asset folder', 400, 'NO_ASSET_SLUG');
    }
    const saved = this.assets.saveVideo(slug, buffer, originalName);
    this.videoCatalog.refresh();
    return saved;
  }

  async adminRemoveVideo(hostId: string, filename: string) {
    const host = await this.requireAiHost(hostId);
    const slug = host.virtualHostAssetSlug;
    if (!slug) {
      throw new BusinessException('Host has no asset folder', 400, 'NO_ASSET_SLUG');
    }
    const videos = this.assets.listVideos(slug);
    if (!videos.some((v) => v.filename === filename)) {
      throw new BusinessException('Video not found', 404, 'VIDEO_NOT_FOUND');
    }
    this.assets.deleteVideo(slug, filename);
    this.videoCatalog.refresh();
    return { removed: true, videos: this.assets.listVideos(slug) };
  }

  async adminUploadProfileImage(hostId: string, buffer: Buffer, originalName: string) {
    const host = await this.requireAiHost(hostId);
    const slug = host.virtualHostAssetSlug;
    if (!slug) {
      throw new BusinessException('Host has no asset folder', 400, 'NO_ASSET_SLUG');
    }
    const image = this.assets.saveProfileImage(slug, buffer, originalName);
    await this.prisma.user.update({
      where: { id: hostId },
      data: { avatarUrl: image.url },
    });
    const avatar = parseJsonField<VirtualHostAvatarConfig>(host.virtualHostAvatar, {});
    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: {
        virtualHostAvatar: { ...avatar, imageUrl: image.url } as Prisma.InputJsonValue,
      },
    });
    return { image, avatarUrl: image.url };
  }

  async adminUploadGalleryImage(hostId: string, buffer: Buffer, originalName: string) {
    const host = await this.requireAiHost(hostId);
    const slug = host.virtualHostAssetSlug;
    if (!slug) {
      throw new BusinessException('Host has no asset folder', 400, 'NO_ASSET_SLUG');
    }
    const image = this.assets.saveGalleryImage(slug, buffer, originalName);
    const gallery = [...parseGallery(host.virtualHostGallery), image];
    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: { virtualHostGallery: gallery as unknown as Prisma.InputJsonValue },
    });
    return { image, gallery };
  }

  async adminRemoveGalleryImage(hostId: string, imageId: string) {
    const host = await this.requireAiHost(hostId);
    const slug = host.virtualHostAssetSlug;
    const gallery = parseGallery(host.virtualHostGallery);
    const target = gallery.find((g) => g.id === imageId || g.filename === imageId);
    if (!target) {
      throw new BusinessException('Gallery image not found', 404, 'GALLERY_NOT_FOUND');
    }
    if (slug) this.assets.deleteGalleryFile(slug, target.filename);
    const next = gallery.filter((g) => g.id !== target.id);
    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: { virtualHostGallery: next as unknown as Prisma.InputJsonValue },
    });
    return { removed: true, gallery: next };
  }

  async adminRefreshAssets(hostId: string) {
    const host = await this.requireAiHost(hostId);
    if (!host.virtualHostAssetSlug) {
      throw new BusinessException('Host has no asset folder', 400, 'NO_ASSET_SLUG');
    }
    const manifest = this.assets.scanAndWriteManifest();
    const stats = this.videoCatalog.refresh();
    return { manifest, stats };
  }

  private async requireAiHost(hostId: string) {
    const host = await this.prisma.hostProfile.findFirst({
      where: { userId: hostId, profileType: { in: ['MANAGED_HOST', 'AI_HOST'] } },
    });
    if (!host) {
      throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');
    }
    return host;
  }

  async adminSetStatus(hostId: string, status: VirtualHostStatus) {
    return this.adminUpdate(hostId, { virtualHostStatus: status });
  }

  async getAdminAnalytics() {
    const [sessions, activeVirtual, topHosts, giftRevenue] = await Promise.all([
      this.prisma.virtualHostSession.aggregate({
        _count: { id: true },
        _avg: { durationSeconds: true },
        _sum: { coinsSpentUnits: true, giftsReceivedCount: true },
      }),
      this.prisma.hostProfile.count({
        where: {
          profileType: { in: ['MANAGED_HOST', 'AI_HOST'] },
          virtualHostEnabled: true,
          virtualHostStatus: 'ONLINE',
        },
      }),
      this.prisma.virtualHostSession.groupBy({
        by: ['hostId'],
        _count: { id: true },
        _sum: { coinsSpentUnits: true, giftsReceivedCount: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.prisma.callGift.aggregate({
        where: {
          call: { virtualHostSession: { isNot: null } },
        },
        _sum: { coinUnits: true },
        _count: { id: true },
      }),
    ]);

    const hostIds = topHosts.map((h) => h.hostId);
    const users = hostIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: hostIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameMap = new Map(users.map((u) => [u.id, u.displayName]));

    const realCalls = await this.prisma.call.count({
      where: {
        status: CallStatus.ended,
        callee: { hostProfile: { profileType: 'REAL_HOST' } },
      },
    });

    const virtualCalls = sessions._count.id;

    return {
      realHostCalls: realCalls,
      virtualHostCalls: virtualCalls,
      activeVirtualHosts: activeVirtual,
      averageDurationSeconds: Math.round(sessions._avg.durationSeconds ?? 0),
      totalCoinsSpent: unitsToCoins(sessions._sum.coinsSpentUnits ?? 0n),
      totalGiftsReceived: sessions._sum.giftsReceivedCount ?? 0,
      giftRevenueCoins: unitsToCoins(giftRevenue._sum.coinUnits ?? 0n),
      topVirtualHosts: topHosts.map((h) => ({
        hostId: h.hostId,
        displayName: nameMap.get(h.hostId) ?? 'Unknown',
        sessions: h._count.id,
        coinsSpent: unitsToCoins(h._sum.coinsSpentUnits ?? 0n),
        giftsReceived: h._sum.giftsReceivedCount ?? 0,
      })),
    };
  }

  private serializeAdminHost(
    host: HostProfileRow & {
      virtualHostAssetSlug?: string | null;
      virtualHostGallery?: unknown;
      virtualHostUsername?: string | null;
      createdAt?: Date;
      user: HostProfileRow['user'] & { dateOfBirth?: Date; createdAt?: Date };
    },
  ) {
    const assetSlug = host.virtualHostAssetSlug ?? null;
    const videoCount = assetSlug ? this.assets.countVideos(assetSlug) : 0;
    const gallery = parseGallery(host.virtualHostGallery);
    const age = host.user.dateOfBirth
      ? Math.floor(
          (Date.now() - new Date(host.user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
        )
      : null;

    return {
      hostId: host.userId,
      profileType: host.profileType,
      virtualHostEnabled: host.virtualHostEnabled,
      virtualHostStatus: host.virtualHostStatus,
      virtualHostPriority: host.virtualHostPriority,
      virtualHostPopularity: host.virtualHostPopularity,
      virtualHostLanguage: host.virtualHostLanguage,
      virtualHostRegion: host.virtualHostRegion,
      virtualHostGreeting: host.virtualHostGreeting,
      virtualHostAssetSlug: assetSlug,
      virtualHostUsername: host.virtualHostUsername ?? null,
      virtualHostGallery: gallery,
      videoCount,
      createdAt: host.createdAt?.toISOString() ?? host.user.createdAt?.toISOString() ?? null,
      age,
      coinsPerMinute: (host as { coinsPerMinuteUnits?: bigint | null }).coinsPerMinuteUnits
        ? unitsToCoinsPerMinute((host as { coinsPerMinuteUnits: bigint }).coinsPerMinuteUnits)
        : 5,
      languages: Array.isArray(host.languages) ? host.languages : [],
      virtualHostVoice: host.virtualHostVoice,
      virtualHostAvatar: host.virtualHostAvatar,
      virtualHostPersonality: host.virtualHostPersonality,
      virtualHostGiftReactions: host.virtualHostGiftReactions,
      virtualHostSchedule: host.virtualHostSchedule,
      virtualHostConversation: host.virtualHostConversation,
      isOnline: host.isOnline,
      isBusy: host.isBusy,
      totalCalls: host.totalCalls,
      rating: host.ratingCount > 0 ? host.ratingSum / host.ratingCount : null,
      user: host.user,
      preview: this.serializeVirtualHostMeta(host),
    };
  }
}