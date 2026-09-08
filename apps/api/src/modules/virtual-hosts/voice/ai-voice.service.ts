import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { BusinessException } from '../../../common/exceptions/business.exception';
import {
  defaultVoiceConfig,
  parseJsonField,
  resolveVoiceProvider,
  type VirtualHostVoiceConfig,
  type VoiceProviderName,
} from '../../../common/utils/virtual-host';
import {
  VOICE_CATALOG,
  chunkTextForSpeech,
  estimateSpeechMs,
  generateStreamId,
} from '../../../common/utils/voice-engine';
import { PrismaService } from '../../../database/prisma.service';
import { AiConversationService } from '../conversation/ai-conversation.service';
import { CartesiaVoiceProvider } from './cartesia-voice.provider';
import { ElevenLabsVoiceProvider } from './elevenlabs-voice.provider';
import { LocalVoiceProvider } from './local-voice.provider';
import { OpenAiVoiceProvider } from './openai-voice.provider';
import type { VoiceProvider } from './voice-provider.interface';
import { VoiceCache } from './voice-cache';
import type { VoiceConfigDto } from './dto/voice-config.dto';

type ActiveVoiceStream = {
  aborted: boolean;
  abortController: AbortController;
};

type PendingStream = {
  callId: string;
  userId: string;
  text: string;
  eventType: string;
  voiceConfig: VirtualHostVoiceConfig;
  sessionId: string;
  hostId: string;
  chunks: string[];
};

@Injectable()
export class AiVoiceService {
  private readonly logger = new Logger(AiVoiceService.name);
  private readonly activeStreams = new Map<string, ActiveVoiceStream>();
  private readonly pendingStreams = new Map<string, PendingStream>();
  private readonly defaultProvider: VoiceProviderName;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly conversation: AiConversationService,
    private readonly cache: VoiceCache,
    private readonly local: LocalVoiceProvider,
    private readonly openAi: OpenAiVoiceProvider,
    private readonly elevenLabs: ElevenLabsVoiceProvider,
    private readonly cartesia: CartesiaVoiceProvider,
  ) {
    const envProvider = this.config.get<string>('AI_VOICE_PROVIDER', 'local').toLowerCase();
    this.defaultProvider =
      envProvider === 'openai' ||
      envProvider === 'elevenlabs' ||
      envProvider === 'cartesia'
        ? envProvider
        : 'local';
  }

  listVoices(provider?: string) {
    const key = (provider ?? 'all').toLowerCase();
    if (key === 'all') {
      return {
        providers: Object.keys(VOICE_CATALOG),
        voices: VOICE_CATALOG,
        languages: ['en', 'hi', 'hinglish', 'es', 'ar', 'fr'],
      };
    }
    const catalog = VOICE_CATALOG[key as keyof typeof VOICE_CATALOG];
    if (!catalog) {
      throw new BusinessException('Unknown voice provider', 400, 'UNKNOWN_VOICE_PROVIDER');
    }
    return { provider: key, voices: catalog, languages: ['en', 'hi', 'hinglish', 'es', 'ar', 'fr'] };
  }

  async startVoice(
    callId: string,
    userId: string,
    text: string,
    eventType = 'message',
  ) {
    const call = await this.conversation.assertCallParticipant(callId, userId);
    const session = call.virtualHostSession!;
    const profile = call.callee.hostProfile;

    const hostVoice = parseJsonField<VirtualHostVoiceConfig>(
      profile?.virtualHostVoice,
      defaultVoiceConfig(profile?.virtualHostLanguage ?? 'en'),
    );
    const voiceConfig: VirtualHostVoiceConfig = {
      ...defaultVoiceConfig(hostVoice.language ?? profile?.virtualHostLanguage ?? 'en'),
      ...hostVoice,
      voiceProvider: resolveVoiceProvider(hostVoice),
    };

    if (!voiceConfig.streamingEnabled) {
      throw new BusinessException('Voice streaming disabled', 400, 'VOICE_DISABLED');
    }

    const streamId = generateStreamId(callId);
    const chunks = chunkTextForSpeech(text);

    await this.prisma.virtualHostVoiceSession.create({
      data: {
        streamId,
        callId,
        sessionId: session.sessionId,
        userId: call.callerId,
        hostId: call.calleeId,
        voiceProvider: resolveVoiceProvider(voiceConfig),
        voiceId: voiceConfig.voiceId ?? 'default',
        language: voiceConfig.language ?? 'en',
        eventType,
        textLength: text.length,
        chunkCount: chunks.length,
        metadata: { emotion: voiceConfig.emotion, speed: voiceConfig.speed },
      },
    });

    this.pendingStreams.set(streamId, {
      callId,
      userId,
      text,
      eventType,
      voiceConfig,
      sessionId: session.sessionId,
      hostId: call.calleeId,
      chunks,
    });

    const provider = resolveVoiceProvider(voiceConfig);
    const mimeType = provider === 'local' ? 'audio/wav' : 'audio/mpeg';

    return {
      streamId,
      format: mimeType,
      mimeType,
      chunkCount: chunks.length,
      provider,
      estimatedSpeechMs: estimateSpeechMs(text, voiceConfig.speed ?? 1),
    };
  }

  streamAudio(streamId: string, userId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const pending = this.pendingStreams.get(streamId);
      if (!pending || pending.userId !== userId) {
        subscriber.error(
          new BusinessException('Voice stream not found', 404, 'VOICE_STREAM_NOT_FOUND'),
        );
        return;
      }

      const control: ActiveVoiceStream = {
        aborted: false,
        abortController: new AbortController(),
      };
      this.activeStreams.set(streamId, control);

      (async () => {
        const started = Date.now();
        let firstChunkMs: number | null = null;
        let speechDurationMs = 0;
        let index = 0;

        try {
          subscriber.next({
            data: { type: 'start', streamId, chunkCount: pending.chunks.length },
          } as MessageEvent);

          for (const chunkText of pending.chunks) {
            if (control.aborted) break;

            const cached = await this.cache.resolve(pending.voiceConfig, chunkText);
            let audio: Buffer;
            let mimeType: string;

            if (cached) {
              audio = cached.audio;
              mimeType = cached.mimeType;
            } else {
              const result = await this.synthesizeWithFallback(
                chunkText,
                pending.voiceConfig,
                control.abortController.signal,
              );
              audio = result.audio;
              mimeType = result.mimeType;
              this.cache.set(pending.voiceConfig, chunkText, result);
            }

            if (firstChunkMs === null) firstChunkMs = Date.now() - started;
            speechDurationMs += estimateSpeechMs(chunkText, pending.voiceConfig.speed ?? 1);

            subscriber.next({
              data: {
                type: 'chunk',
                index,
                audio: audio.toString('base64'),
                mimeType,
                speaking: true,
              },
            } as MessageEvent);
            index++;
          }

          if (!control.aborted) {
            subscriber.next({
              data: {
                type: 'done',
                streamId,
                firstChunkMs,
                speechDurationMs,
                chunkCount: index,
              },
            } as MessageEvent);

            await this.prisma.virtualHostVoiceSession.update({
              where: { streamId },
              data: {
                firstChunkMs,
                speechDurationMs,
                chunkCount: index,
                endedAt: new Date(),
              },
            });
          } else {
            await this.markInterrupted(streamId);
          }

          subscriber.complete();
        } catch (err) {
          this.logger.warn(`Voice stream error ${streamId}: ${(err as Error).message}`);
          subscriber.error(err);
        } finally {
          this.activeStreams.delete(streamId);
          this.pendingStreams.delete(streamId);
        }
      })();

      return () => {
        control.aborted = true;
        control.abortController.abort();
        this.activeStreams.delete(streamId);
      };
    });
  }

  async interruptVoice(userId: string, callId?: string, streamId?: string) {
    let interrupted = false;

    if (streamId) {
      const s = this.activeStreams.get(streamId);
      if (s) {
        s.aborted = true;
        s.abortController.abort();
        interrupted = true;
        await this.markInterrupted(streamId);
      }
    }

    if (callId) {
      for (const [id, stream] of this.activeStreams) {
        const pending = this.pendingStreams.get(id);
        if (pending?.callId === callId && pending.userId === userId) {
          stream.aborted = true;
          stream.abortController.abort();
          interrupted = true;
          await this.markInterrupted(id);
        }
      }
    }

    return { interrupted };
  }

  async testVoice(dto: {
    text: string;
    hostId?: string;
    voice?: Record<string, unknown>;
    language?: string;
    speed?: number;
    pitch?: number;
    emotion?: string;
  }) {
    let voiceConfig = defaultVoiceConfig(dto.language ?? 'en');

    if (dto.hostId) {
      const profile = await this.prisma.hostProfile.findFirst({
        where: { userId: dto.hostId, profileType: { in: ['MANAGED_HOST', 'AI_HOST'] } },
      });
      if (!profile) {
        throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');
      }
      voiceConfig = {
        ...voiceConfig,
        ...parseJsonField<VirtualHostVoiceConfig>(profile.virtualHostVoice, {}),
      };
    }

    voiceConfig = {
      ...voiceConfig,
      ...(dto.voice as VirtualHostVoiceConfig | undefined),
      language: dto.language ?? voiceConfig.language,
      speed: dto.speed ?? voiceConfig.speed,
      pitch: dto.pitch ?? voiceConfig.pitch,
      emotion: dto.emotion ?? voiceConfig.emotion,
    };

    const started = Date.now();
    const result = await this.synthesizeWithFallback(dto.text, voiceConfig);
    const latencyMs = Date.now() - started;

    return {
      audio: result.audio.toString('base64'),
      mimeType: result.mimeType,
      latencyMs,
      provider: resolveVoiceProvider(voiceConfig),
      speechDurationMs: estimateSpeechMs(dto.text, voiceConfig.speed ?? 1),
      voiceConfig,
    };
  }

  async adminUpdateVoiceConfig(hostId: string, dto: VoiceConfigDto) {
    const profile = await this.prisma.hostProfile.findFirst({
      where: { userId: hostId, profileType: { in: ['MANAGED_HOST', 'AI_HOST'] } },
    });
    if (!profile) {
      throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');
    }

    const current = parseJsonField<VirtualHostVoiceConfig>(
      profile.virtualHostVoice,
      defaultVoiceConfig(profile.virtualHostLanguage ?? 'en'),
    );
    const merged = { ...current, ...dto, streamingEnabled: true };

    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: { virtualHostVoice: merged },
    });

    return { hostId, voice: merged };
  }

  async getVoiceAnalytics(hostId?: string) {
    const where = hostId ? { hostId } : {};
    const sessions = await this.prisma.virtualHostVoiceSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const total = sessions.length;
    const interrupted = sessions.filter((s) => s.interrupted).length;
    const withLatency = sessions.filter((s) => s.firstChunkMs != null);
    const avgFirstChunkMs =
      withLatency.length > 0
        ? Math.round(
            withLatency.reduce((sum, s) => sum + (s.firstChunkMs ?? 0), 0) / withLatency.length,
          )
        : 0;
    const avgSpeechMs =
      total > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.speechDurationMs, 0) / total)
        : 0;

    const languageCounts = new Map<string, number>();
    const providerCounts = new Map<string, number>();
    const voiceCounts = new Map<string, number>();

    for (const s of sessions) {
      languageCounts.set(s.language, (languageCounts.get(s.language) ?? 0) + 1);
      providerCounts.set(s.voiceProvider, (providerCounts.get(s.voiceProvider) ?? 0) + 1);
      const vk = `${s.voiceProvider}:${s.voiceId}`;
      voiceCounts.set(vk, (voiceCounts.get(vk) ?? 0) + 1);
    }

    const repeatUsers = await this.prisma.virtualHostVoiceSession.groupBy({
      by: ['userId'],
      where: hostId ? { hostId } : {},
      _count: { id: true },
    });

    return {
      totalVoiceSessions: total,
      interruptedSessions: interrupted,
      interruptionRate: total > 0 ? Math.round((interrupted / total) * 100) : 0,
      averageFirstChunkMs: avgFirstChunkMs,
      averageSpeechDurationMs: avgSpeechMs,
      subSecondFirstChunkRate:
        withLatency.length > 0
          ? Math.round(
              (withLatency.filter((s) => (s.firstChunkMs ?? 9999) < 1000).length /
                withLatency.length) *
                100,
            )
          : 0,
      languageUsage: [...languageCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([language, count]) => ({ language, count })),
      providerUsage: [...providerCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([provider, count]) => ({ provider, count })),
      voiceUsage: [...voiceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([voice, count]) => ({ voice, count })),
      repeatVoiceUsers: repeatUsers.filter((r) => r._count.id > 1).length,
      retentionRate:
        repeatUsers.length > 0
          ? Math.round(
              (repeatUsers.filter((r) => r._count.id > 1).length / repeatUsers.length) * 100,
            )
          : 0,
    };
  }

  private resolveProvider(name: VoiceProviderName): VoiceProvider {
    switch (name) {
      case 'openai':
        return this.openAi;
      case 'elevenlabs':
        return this.elevenLabs;
      case 'cartesia':
        return this.cartesia;
      default:
        return this.local;
    }
  }

  private async synthesizeWithFallback(
    text: string,
    config: VirtualHostVoiceConfig,
    signal?: AbortSignal,
  ) {
    const primary = resolveVoiceProvider(config);
    const chain: VoiceProviderName[] = [primary];
    if (primary !== 'local') chain.push('local');
    if (primary !== 'openai' && this.config.get('OPENAI_API_KEY')) chain.push('openai');

    const seen = new Set<VoiceProviderName>();
    for (const name of chain) {
      if (seen.has(name)) continue;
      seen.add(name);
      try {
        return await this.resolveProvider(name).synthesize(text, config, signal);
      } catch (err) {
        this.logger.debug(`Voice provider ${name} failed: ${(err as Error).message}`);
      }
    }

    return this.local.synthesize(text, config, signal);
  }

  private async markInterrupted(streamId: string) {
    await this.prisma.virtualHostVoiceSession.updateMany({
      where: { streamId, interrupted: false },
      data: { interrupted: true, endedAt: new Date() },
    });
  }
}