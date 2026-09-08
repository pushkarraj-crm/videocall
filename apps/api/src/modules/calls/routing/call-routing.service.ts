import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { CallHostType, Prisma } from '@prisma/client';
import { BusinessException } from '../../../common/exceptions/business.exception';
import {
  isAiHostProfile,
  isRealHostAvailable,
  pickAiHost,
  pickBestRealHost,
  scoreAiHost,
  scoreRealHost,
  type CallRoutingPreferences,
} from '../../../common/utils/call-routing-engine';
import { isHeartbeatFresh } from '../../../common/utils/host-heartbeat';
import { PrismaService } from '../../../database/prisma.service';
import { CallsService } from '../calls.service';
import type { UpdateCallRoutingSettingsDto } from './dto/call-routing-settings.dto';
import { AiHostAssetsService } from '../../../integrations/ai-host-assets/ai-host-assets.service';
import { AiVideoCatalogService } from '../../../integrations/ai-host-assets/ai-video-catalog.service';
import { CallFallbackScheduler } from './call-fallback.scheduler';

@Injectable()
export class CallRoutingService {
  private readonly logger = new Logger(CallRoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CallsService))
    private readonly calls: CallsService,
    private readonly assets: AiHostAssetsService,
    /** Admin settings display only — not used for routing selection. */
    private readonly videoCatalog: AiVideoCatalogService,
    private readonly fallbackScheduler: CallFallbackScheduler,
  ) {
    this.fallbackScheduler.bind(this.calls);
  }

  cancelAiFallback(callId: string, reason: string) {
    this.fallbackScheduler.cancel(callId, reason);
  }

  async getSettings() {
    const row = await this.ensureSettings();
    return this.serializeSettings(row);
  }

  async updateSettings(dto: UpdateCallRoutingSettingsDto) {
    const row = await this.prisma.callRoutingSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
    return this.serializeSettings(row);
  }

  async matchCall(
    callerId: string,
    callerIp?: string,
    overrides?: { preferredLanguage?: string; preferredRegion?: string },
  ) {
    const settings = await this.ensureSettings();
    const caller = await this.prisma.user.findUniqueOrThrow({
      where: { id: callerId },
      select: { primaryLanguage: true },
    });

    const prefs: CallRoutingPreferences = {
      callerLanguage: caller.primaryLanguage,
      preferredLanguage: overrides?.preferredLanguage ?? settings.preferredLanguage,
      preferredRegion: overrides?.preferredRegion ?? settings.preferredRegion,
    };

    const realHost = await this.findBestRealHost(prefs);

    if (realHost) {
      const initiated = await this.calls.initiateCall(callerId, realHost.userId, callerIp, {
        hostCallType: CallHostType.REAL_HOST,
      });

      this.logger.log(
        JSON.stringify({
          event: 'HOST_RINGING',
          callId: initiated.callId,
          hostId: realHost.userId,
          roomId: initiated.roomId,
        }),
      );

      this.fallbackScheduler.schedule(initiated.callId, {
        callerId,
        callerIp,
        timeoutMs: settings.realHostTimeoutSeconds * 1000,
        aiFallbackEnabled: settings.aiFallbackEnabled,
        prefs,
      });

      return {
        ...initiated,
        routing: 'REAL_HOST' as const,
        hostCallType: CallHostType.REAL_HOST,
        matchedHostId: realHost.userId,
        aiFallback: false,
      };
    }

    if (!settings.aiFallbackEnabled) {
      throw new BusinessException('No hosts available right now', 503, 'NO_HOSTS_AVAILABLE');
    }

    return this.initiateAiMatch(callerId, callerIp, prefs, settings);
  }

  private async initiateAiMatch(
    callerId: string,
    callerIp: string | undefined,
    prefs: CallRoutingPreferences,
    settings: Awaited<ReturnType<typeof this.ensureSettings>>,
    aiFallback = false,
  ) {
    const aiHost = await this.pickAiHost(settings, prefs);
    if (!aiHost) {
      throw new BusinessException('No AI hosts available', 503, 'NO_AI_HOSTS');
    }

    const lockedVideoUrl = this.assets.pickRandomIdleVideo(aiHost.assetSlug);

    const initiated = await this.calls.initiateCall(callerId, aiHost.userId, callerIp, {
      hostCallType: CallHostType.AI_HOST,
      lockedVideoUrl: lockedVideoUrl ?? undefined,
    });

    return {
      ...initiated,
      routing: 'AI_HOST' as const,
      hostCallType: CallHostType.AI_HOST,
      matchedHostId: aiHost.userId,
      aiFallback,
      lockedVideoUrl: lockedVideoUrl ?? null,
    };
  }

  private async ensureSettings() {
    return this.prisma.callRoutingSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
  }

  private serializeSettings(row: {
    aiFallbackEnabled: boolean;
    realHostTimeoutSeconds: number;
    preferredRegion: string | null;
    preferredLanguage: string | null;
    randomAiSelection: boolean;
    defaultAiHostId: string | null;
    maxConcurrentAiSessions: number;
    updatedAt: Date;
  }) {
    return {
      aiFallbackEnabled: row.aiFallbackEnabled,
      realHostTimeoutSeconds: row.realHostTimeoutSeconds,
      preferredRegion: row.preferredRegion,
      preferredLanguage: row.preferredLanguage,
      randomAiSelection: row.randomAiSelection,
      defaultAiHostId: row.defaultAiHostId,
      maxConcurrentAiSessions: row.maxConcurrentAiSessions,
      videoCatalog: this.videoCatalog.getStats(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async findBestRealHost(prefs: CallRoutingPreferences) {
    const hosts = await this.prisma.hostProfile.findMany({
      where: {
        profileType: 'REAL_HOST',
        isOnline: true,
        isBusy: false,
        adminCallsDisabled: false,
      },
      include: {
        user: { select: { id: true, displayName: true, primaryLanguage: true } },
        hostHeartbeat: { select: { lastBeatAt: true } },
      },
    });

    const candidates = hosts
      .filter(
        (h) =>
          isRealHostAvailable(h) && isHeartbeatFresh(h.hostHeartbeat?.lastBeatAt),
      )
      .map((h) => ({
        userId: h.userId,
        displayName: h.user.displayName,
        primaryLanguage: h.user.primaryLanguage,
        virtualHostRegion: h.virtualHostRegion,
        lastSeenAt: h.lastSeenAt,
        score: scoreRealHost(h, prefs) - (h.lastSeenAt ? 0 : 1),
      }));

    return pickBestRealHost(candidates);
  }

  private async pickAiHost(
    settings: Awaited<ReturnType<typeof this.ensureSettings>>,
    prefs: CallRoutingPreferences,
  ) {
    const activeAiSessions = await this.prisma.virtualHostSession.count({
      where: { endedAt: null, profileType: { in: ['AI_HOST', 'MANAGED_HOST'] } },
    });

    if (activeAiSessions >= settings.maxConcurrentAiSessions) {
      throw new BusinessException('AI hosts at capacity', 503, 'AI_CAPACITY');
    }

    const eligibleWhere: Prisma.HostProfileWhereInput = {
      virtualHostEnabled: true,
      virtualHostStatus: 'ONLINE',
      isOnline: true,
      profileType: { in: ['AI_HOST', 'MANAGED_HOST'] },
      adminCallsDisabled: false,
      user: { deletedAt: null, status: 'active' },
    };

    if (settings.defaultAiHostId && !settings.randomAiSelection) {
      const fixed = await this.prisma.hostProfile.findFirst({
        where: { ...eligibleWhere, userId: settings.defaultAiHostId },
        include: { user: { select: { displayName: true, primaryLanguage: true } } },
      });
      if (fixed && isAiHostProfile(fixed)) {
        return {
          userId: fixed.userId,
          displayName: fixed.user.displayName,
          assetSlug: fixed.virtualHostAssetSlug ?? '',
          sceneSlug: 'bedroom',
          outfitSlug: 'casual',
          score: 999,
        };
      }
    }

    const hosts = await this.prisma.hostProfile.findMany({
      where: eligibleWhere,
      include: { user: { select: { displayName: true, primaryLanguage: true } } },
    });

    const candidates = hosts
      .filter((h) => isAiHostProfile(h))
      .map((h) => ({
        userId: h.userId,
        displayName: h.user.displayName,
        assetSlug: h.virtualHostAssetSlug ?? '',
        sceneSlug: 'bedroom',
        outfitSlug: 'casual',
        score: scoreAiHost(h, prefs),
      }));

    return pickAiHost(candidates, settings.randomAiSelection);
  }
}