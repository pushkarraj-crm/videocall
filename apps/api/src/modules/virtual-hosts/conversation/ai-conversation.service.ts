import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallStatus, Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { BusinessException } from '../../../common/exceptions/business.exception';
import {
  type CallEventType,
  buildSystemPrompt,
  chunkForStreaming,
  type ConversationContext,
  defaultConversationConfig,
  type ExtendedPersonalityConfig,
  memoryRowToSlice,
  mergeConversationHistory,
  normalizeLanguage,
  type VirtualHostConversationConfig,
} from '../../../common/utils/conversation-engine';
import {
  buildMemorySummary,
  detectMessageLanguage,
  extractFactsFromMessage,
  isAbusiveMessage,
  summarizeCallTurns,
  toMemoryRecord,
} from '../../../common/utils/memory-engine';
import { defaultQualitySettings } from '../../../common/utils/personality-engine';
import {
  clampRelationshipScore,
  daysSince,
  getRelationshipTier,
  isDailyCallStreak,
  relationshipScoreDelta,
} from '../../../common/utils/relationship-engine';
import {
  getCachedPrompt,
  invalidatePromptCache,
  promptCacheKey,
  setCachedPrompt,
} from '../../../common/utils/conversation-prompt-cache';
import { parseJsonField } from '../../../common/utils/virtual-host';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../integrations/redis/redis.service';
import { WalletService } from '../../wallet/wallet.service';
import type { AiProvider } from './ai-provider.interface';
import { LocalAiProvider } from './local-ai.provider';
import { OpenAiProvider } from './openai-ai.provider';
import type { ConversationConfigDto } from './dto/conversation-config.dto';
import type { UpdateAIHostMemoryDto } from './dto/update-memory.dto';

type ActiveStream = { aborted: boolean };

@Injectable()
export class AiConversationService {
  private readonly logger = new Logger(AiConversationService.name);
  private readonly activeStreams = new Map<string, ActiveStream>();
  private readonly provider: AiProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly wallet: WalletService,
    private readonly localAi: LocalAiProvider,
    private readonly openAi: OpenAiProvider,
  ) {
    const name = this.config.get<string>('AI_CONVERSATION_PROVIDER', 'local');
    this.provider = name === 'openai' ? this.openAi : this.localAi;
  }

  async assertCallParticipant(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        virtualHostSession: true,
        callee: { include: { hostProfile: true } },
        caller: { select: { id: true, displayName: true } },
      },
    });

    if (!call) throw new BusinessException('Call not found', 404, 'CALL_NOT_FOUND');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new BusinessException('Not a participant', 403, 'NOT_PARTICIPANT');
    }
    if (!call.virtualHostSession) {
      throw new BusinessException('Not a virtual host call', 400, 'NOT_VIRTUAL_CALL');
    }
    if (call.status === CallStatus.ended) {
      throw new BusinessException('Call has ended', 400, 'CALL_ENDED');
    }

    return call;
  }

  async preloadContext(callId: string, userId: string) {
    const call = await this.assertCallParticipant(callId, userId);
    const ctx = await this.buildContext(call, userId);
    const cacheKey = promptCacheKey(call.calleeId, userId, ctx.language);
    let systemPrompt = getCachedPrompt(cacheKey);
    if (!systemPrompt) {
      systemPrompt = buildSystemPrompt(ctx);
      setCachedPrompt(cacheKey, systemPrompt);
      if (this.redis.isEnabled) {
        await this.redis.set(cacheKey, systemPrompt, 900);
      }
    }

    const tier = getRelationshipTier(ctx.memory.relationshipScore ?? 0);
    return {
      callId,
      sessionId: call.virtualHostSession!.sessionId,
      language: ctx.language,
      memory: ctx.memory,
      relationship: { score: ctx.memory.relationshipScore ?? 0, tier: tier.label, emoji: tier.emoji },
      personality: ctx.personality,
      voice: parseJsonField(call.callee.hostProfile?.virtualHostVoice, {}),
      systemPromptCached: true,
      provider: this.provider.name,
    };
  }

  async sendMessage(callId: string, userId: string, message: string, clientTurnId?: string) {
    const started = Date.now();
    const call = await this.assertCallParticipant(callId, userId);
    const session = call.virtualHostSession!;

    await this.recordTurn({
      sessionId: session.sessionId,
      callId,
      userId: call.callerId,
      hostId: call.calleeId,
      role: 'user',
      eventType: 'message',
      content: message,
      metadata: clientTurnId ? { clientTurnId } : undefined,
    });

    const ctx = await this.buildContext(call, userId);
    const reply = await this.provider.generate(ctx, message);
    const responseMs = Date.now() - started;

    const turn = await this.recordTurn({
      sessionId: session.sessionId,
      callId,
      userId: call.callerId,
      hostId: call.calleeId,
      role: 'assistant',
      eventType: 'message',
      content: reply.text,
      emotion: reply.emotion,
      responseMs,
      metadata: { topics: reply.topics, provider: this.provider.name },
    });

    await this.updateSessionMetrics(session.sessionId, responseMs);
    await this.persistQualityMemory({
      userId: call.callerId,
      hostId: call.calleeId,
      callId,
      userMessage: message,
      aiReply: reply.text,
      emotion: reply.emotion,
      topics: reply.topics,
      callDurationSeconds: ctx.callDurationSeconds,
      giftsReceived: ctx.giftsReceived,
    });

    return {
      turnId: turn.id,
      text: reply.text,
      emotion: reply.emotion,
      responseMs,
      speaking: true,
      chunks: chunkForStreaming(reply.text),
    };
  }

  streamMessage(callId: string, userId: string, message: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const streamKey = `${callId}:${userId}`;
      const control: ActiveStream = { aborted: false };
      this.activeStreams.set(streamKey, control);

      (async () => {
        try {
          subscriber.next({ data: { type: 'thinking', speaking: false } } as MessageEvent);

          const result = await this.sendMessage(callId, userId, message);
          if (control.aborted) return;

          subscriber.next({
            data: { type: 'start', emotion: result.emotion, responseMs: result.responseMs },
          } as MessageEvent);

          for (const chunk of result.chunks) {
            if (control.aborted) break;
            subscriber.next({ data: { type: 'chunk', text: chunk, speaking: true } } as MessageEvent);
            await new Promise((r) => setTimeout(r, 35));
          }

          if (!control.aborted) {
            subscriber.next({
              data: { type: 'done', text: result.text, emotion: result.emotion, turnId: result.turnId },
            } as MessageEvent);
          }
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        } finally {
          this.activeStreams.delete(streamKey);
        }
      })();

      return () => {
        control.aborted = true;
        this.activeStreams.delete(streamKey);
      };
    });
  }

  interruptStream(callId: string, userId: string) {
    const key = `${callId}:${userId}`;
    const s = this.activeStreams.get(key);
    if (s) s.aborted = true;
    return { interrupted: Boolean(s) };
  }

  async handleEvent(
    callId: string,
    userId: string,
    eventType: CallEventType,
    giftName?: string,
  ) {
    const started = Date.now();
    const call = await this.assertCallParticipant(callId, userId);
    const session = call.virtualHostSession!;
    const ctx = await this.buildContext(call, userId, eventType, giftName);
    const reply = await this.provider.generate(ctx);
    const responseMs = Date.now() - started;

    const turn = await this.recordTurn({
      sessionId: session.sessionId,
      callId,
      userId: call.callerId,
      hostId: call.calleeId,
      role: 'assistant',
      eventType,
      content: reply.text,
      emotion: reply.emotion,
      responseMs,
      metadata: { giftName, provider: this.provider.name },
    });

    await this.updateSessionMetrics(session.sessionId, responseMs);

    if (eventType === 'gift_received') {
      await this.bumpRelationship(call.callerId, call.calleeId, 'gift');
    }

    if (eventType === 'call_ending') {
      await this.finalizeCallMemory(call.callerId, call.calleeId, call.id, ctx.callDurationSeconds);
    }

    return { turnId: turn.id, text: reply.text, emotion: reply.emotion, responseMs, eventType };
  }

  async getHistory(callId: string, userId: string, limit = 50) {
    await this.assertCallParticipant(callId, userId);
    const turns = await this.prisma.virtualHostConversationTurn.findMany({
      where: { callId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return {
      turns: turns.map((t) => ({
        id: t.id,
        role: t.role,
        eventType: t.eventType,
        content: t.content,
        emotion: t.emotion,
        responseMs: t.responseMs,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async adminUpdateConversationConfig(hostId: string, dto: ConversationConfigDto) {
    const profile = await this.prisma.hostProfile.findFirst({
      where: { userId: hostId, profileType: { in: ['MANAGED_HOST', 'AI_HOST'] } },
    });
    if (!profile) throw new BusinessException('Virtual host not found', 404, 'VIRTUAL_HOST_NOT_FOUND');

    const current = parseJsonField<VirtualHostConversationConfig>(
      profile.virtualHostConversation,
      defaultConversationConfig(),
    );
    const merged = { ...current, ...dto };

    await this.prisma.hostProfile.update({
      where: { userId: hostId },
      data: { virtualHostConversation: merged },
    });
    invalidatePromptCache(hostId);
    return { hostId, conversation: merged };
  }

  async adminResetMemory(hostId: string, userId: string) {
    await this.prisma.aIHostMemory.deleteMany({ where: { userId, hostId } });
    await this.prisma.conversationHistory.deleteMany({ where: { userId, hostId } });
    invalidatePromptCache(hostId, userId);
    return { reset: true, hostId, userId };
  }

  async adminListMemories(hostId?: string, userId?: string, limit = 50) {
    const rows = await this.prisma.aIHostMemory.findMany({
      where: {
        ...(hostId ? { hostId } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, displayName: true } },
        host: { select: { id: true, displayName: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        ...r,
        tier: getRelationshipTier(r.relationshipScore).label,
      })),
    };
  }

  async adminGetMemory(hostId: string, userId: string) {
    const memory = await this.ensureAIHostMemory(userId, hostId);
    const history = await this.prisma.conversationHistory.findMany({
      where: { hostId, userId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
    return {
      memory: { ...memory, tier: getRelationshipTier(memory.relationshipScore).label },
      conversationHistory: history,
    };
  }

  async adminUpdateMemory(hostId: string, userId: string, dto: UpdateAIHostMemoryDto) {
    const current = await this.ensureAIHostMemory(userId, hostId);
    const merged = { ...current, ...dto };
    const memory = await this.prisma.aIHostMemory.update({
      where: { id: current.id },
      data: {
        ...dto,
        memorySummary: buildMemorySummary(toMemoryRecord(merged)),
      },
    });
    invalidatePromptCache(hostId, userId);
    return memory;
  }

  async adminDeleteMemory(hostId: string, userId: string) {
    await this.prisma.aIHostMemory.deleteMany({ where: { hostId, userId } });
    await this.prisma.conversationHistory.deleteMany({ where: { hostId, userId } });
    invalidatePromptCache(hostId, userId);
    return { deleted: true };
  }

  async getConversationAnalytics(hostId?: string) {
    const where = hostId ? { hostId } : {};
    const [turns, sessions] = await Promise.all([
      this.prisma.virtualHostConversationTurn.aggregate({
        where: { ...where, role: 'assistant' },
        _count: { id: true },
        _avg: { responseMs: true },
      }),
      this.prisma.virtualHostSession.aggregate({
        where: hostId ? { hostId } : {},
        _avg: { turnCount: true, avgResponseMs: true, durationSeconds: true },
        _count: { id: true },
      }),
    ]);

    const topicRows = await this.prisma.virtualHostConversationTurn.findMany({
      where: { ...where, role: 'assistant' },
      select: { metadata: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    const topicCounts = new Map<string, number>();
    for (const row of topicRows) {
      const meta = row.metadata as { topics?: string[] } | null;
      for (const t of meta?.topics ?? []) {
        topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      }
    }

    const repeatUsers = await this.prisma.virtualHostSession.groupBy({
      by: ['userId'],
      where: hostId ? { hostId } : {},
      _count: { id: true },
    });

    return {
      totalAssistantTurns: turns._count.id,
      averageResponseMs: Math.round(turns._avg.responseMs ?? 0),
      averageTurnsPerSession: Math.round(sessions._avg.turnCount ?? 0),
      averageSessionDurationSeconds: Math.round(sessions._avg.durationSeconds ?? 0),
      totalSessions: sessions._count.id,
      topTopics: [...topicCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count })),
      repeatCallUsers: repeatUsers.filter((r) => r._count.id > 1).length,
      retentionRate:
        repeatUsers.length > 0
          ? Math.round(
              (repeatUsers.filter((r) => r._count.id > 1).length / repeatUsers.length) * 100,
            )
          : 0,
    };
  }

  private async buildContext(
    call: {
      id: string;
      callerId: string;
      calleeId: string;
      startedAt: Date | null;
      durationSeconds: number;
      caller: { displayName: string };
      callee: {
        displayName: string;
        hostProfile: {
          virtualHostPersonality: unknown;
          virtualHostConversation: unknown;
          virtualHostLanguage: string | null;
          virtualHostGreeting: string | null;
          virtualHostVoice: unknown;
        } | null;
      };
      virtualHostSession: { giftsReceivedCount: number } | null;
    },
    userId: string,
    eventType?: CallEventType,
    giftName?: string,
  ): Promise<ConversationContext> {
    const profile = call.callee.hostProfile;
    const personality = parseJsonField<ExtendedPersonalityConfig>(profile?.virtualHostPersonality, {
      style: 'Friendly',
      mood: 'warm',
      emojiUsage: 'medium',
      flirtingLevel: 'light',
    });
    const conversation = parseJsonField<VirtualHostConversationConfig>(
      profile?.virtualHostConversation,
      defaultConversationConfig(),
    );

    const quality = { ...defaultQualitySettings(), ...conversation };

    const memoryRow = await this.ensureAIHostMemory(call.callerId, call.calleeId);

    const [recentHistory, inCallTurns] = await Promise.all([
      this.prisma.conversationHistory.findMany({
        where: { userId: call.callerId, hostId: call.calleeId },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
      this.prisma.virtualHostConversationTurn.findMany({
        where: { callId: call.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const recentTurns = [
      ...recentHistory.reverse().flatMap((h) => [
        { role: 'user', content: h.userMessage },
        { role: 'assistant', content: h.aiReply },
      ]),
      ...inCallTurns.reverse().map((t) => ({ role: t.role, content: t.content })),
    ].slice(-20);

    const memory = memoryRowToSlice(memoryRow, quality);
    memory.recentTurns = recentTurns;
    memory.lastCallSummary = memoryRow.memorySummary;

    let balanceCoins: number | undefined;
    if (call.callerId === userId) {
      try {
        const w = await this.wallet.getWalletSummary(userId);
        balanceCoins = w.balanceCoins;
      } catch {
        /* optional */
      }
    }

    const elapsed = call.startedAt
      ? Math.floor((Date.now() - call.startedAt.getTime()) / 1000)
      : call.durationSeconds;

    return {
      now: new Date().toISOString(),
      hostName: call.callee.displayName,
      userName: call.caller.displayName,
      language: normalizeLanguage(
        memory.preferredLanguage ?? profile?.virtualHostLanguage ?? personality.language,
      ),
      personality: {
        ...personality,
        greeting: profile?.virtualHostGreeting ?? personality.greeting,
      },
      conversation,
      memory,
      callDurationSeconds: elapsed,
      giftsReceived: call.virtualHostSession?.giftsReceivedCount ?? 0,
      balanceCoins,
      eventType,
      giftName,
    };
  }

  private async recordTurn(params: {
    sessionId: string;
    callId: string;
    userId: string;
    hostId: string;
    role: string;
    eventType: string;
    content: string;
    emotion?: string;
    responseMs?: number;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.virtualHostConversationTurn.create({
      data: {
        sessionId: params.sessionId,
        callId: params.callId,
        userId: params.userId,
        hostId: params.hostId,
        role: params.role,
        eventType: params.eventType,
        content: params.content,
        emotion: params.emotion,
        responseMs: params.responseMs,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async updateSessionMetrics(sessionId: string, responseMs: number) {
    const session = await this.prisma.virtualHostSession.findUnique({
      where: { sessionId },
      select: { turnCount: true, avgResponseMs: true },
    });
    if (!session) return;

    const newCount = session.turnCount + 1;
    const newAvg = Math.round(
      (session.avgResponseMs * session.turnCount + responseMs) / newCount,
    );

    await this.prisma.virtualHostSession.update({
      where: { sessionId },
      data: { turnCount: newCount, avgResponseMs: newAvg },
    });
  }

  private async ensureAIHostMemory(userId: string, hostId: string) {
    const existing = await this.prisma.aIHostMemory.findUnique({
      where: { hostId_userId: { hostId, userId } },
    });
    if (existing) return existing;

    const legacy = await this.prisma.virtualHostMemory.findUnique({
      where: { userId_hostId: { userId, hostId } },
    });

    return this.prisma.aIHostMemory.create({
      data: {
        userId,
        hostId,
        nickname: legacy?.nickname,
        preferredLanguage: legacy?.preferredLanguage,
        favoriteTopics: parseJsonField(legacy?.favoriteTopics, []),
        relationshipScore: legacy?.friendshipScore ?? 0,
        callCount: legacy?.callCount ?? 0,
        memorySummary: legacy?.lastCallSummary,
        lastCall: legacy?.lastConversationAt,
      },
    });
  }

  private async persistQualityMemory(params: {
    userId: string;
    hostId: string;
    callId: string;
    userMessage: string;
    aiReply: string;
    emotion: string;
    topics: string[];
    callDurationSeconds: number;
    giftsReceived: number;
  }) {
    const existing = await this.ensureAIHostMemory(params.userId, params.hostId);
    const facts = extractFactsFromMessage(params.userMessage);
    const favTopics = new Set(parseJsonField<string[]>(existing.favoriteTopics, []));
    params.topics.forEach((t) => favTopics.add(t));

    let scoreDelta = relationshipScoreDelta('message', { messageLength: params.userMessage.length });
    if (params.callDurationSeconds >= 300) scoreDelta += relationshipScoreDelta('long_conversation');
    if (isAbusiveMessage(params.userMessage)) scoreDelta += relationshipScoreDelta('abusive');

    const hobbies = new Set(parseJsonField<string[]>(existing.hobbies, []));
    facts.hobbies?.forEach((h) => hobbies.add(h));

    const updated = await this.prisma.aIHostMemory.update({
      where: { id: existing.id },
      data: {
        nickname: facts.nickname ?? existing.nickname,
        favoriteColor: facts.favoriteColor ?? existing.favoriteColor,
        favoriteFood: facts.favoriteFood ?? existing.favoriteFood,
        favoriteMovie: facts.favoriteMovie ?? existing.favoriteMovie,
        favoriteMusic: facts.favoriteMusic ?? existing.favoriteMusic,
        favoriteOutfit: facts.favoriteOutfit ?? existing.favoriteOutfit,
        birthday: facts.birthday ?? existing.birthday,
        city: facts.city ?? existing.city,
        country: facts.country ?? existing.country,
        work: facts.work ?? existing.work,
        preferredLanguage: facts.preferredLanguage ?? existing.preferredLanguage,
        hobbies: [...hobbies],
        favoriteTopics: [...favTopics],
        relationshipScore: clampRelationshipScore(existing.relationshipScore + scoreDelta),
        notes: facts.notes ? `${existing.notes ?? ''} ${facts.notes}`.trim().slice(0, 500) : existing.notes,
      },
    });

    await this.prisma.aIHostMemory.update({
      where: { id: updated.id },
      data: { memorySummary: buildMemorySummary(toMemoryRecord(updated)) },
    });

    await this.prisma.conversationHistory.create({
      data: {
        hostId: params.hostId,
        userId: params.userId,
        callId: params.callId,
        userMessage: params.userMessage,
        aiReply: params.aiReply,
        emotion: params.emotion,
      },
    });

    await this.syncLegacyMemory(params.userId, params.hostId, params.userMessage, params.aiReply, updated);
  }

  private async syncLegacyMemory(
    userId: string,
    hostId: string,
    userMsg: string,
    assistantMsg: string,
    row: { relationshipScore: number; favoriteTopics: unknown; nickname: string | null },
  ) {
    const existing = await this.prisma.virtualHostMemory.findUnique({
      where: { userId_hostId: { userId, hostId } },
    });
    const history = mergeConversationHistory(existing?.conversationHistory, {
      role: 'user',
      content: userMsg,
      at: new Date().toISOString(),
    });
    const withAssistant = mergeConversationHistory(history, {
      role: 'assistant',
      content: assistantMsg,
      at: new Date().toISOString(),
    });
    await this.prisma.virtualHostMemory.upsert({
      where: { userId_hostId: { userId, hostId } },
      create: {
        userId,
        hostId,
        nickname: row.nickname,
        conversationHistory: withAssistant,
        favoriteTopics: parseJsonField(row.favoriteTopics, []),
        friendshipScore: row.relationshipScore,
        lastCallSummary: assistantMsg.slice(0, 200),
      },
      update: {
        nickname: row.nickname,
        conversationHistory: withAssistant,
        favoriteTopics: parseJsonField(row.favoriteTopics, []),
        friendshipScore: row.relationshipScore,
        lastConversationAt: new Date(),
        lastCallSummary: assistantMsg.slice(0, 200),
      },
    });
  }

  private async bumpRelationship(userId: string, hostId: string, event: 'gift' | 'recharge' | 'positive') {
    const row = await this.ensureAIHostMemory(userId, hostId);
    const delta = relationshipScoreDelta(event);
    const data: Prisma.AIHostMemoryUpdateInput = {
      relationshipScore: clampRelationshipScore(row.relationshipScore + delta),
    };
    if (event === 'gift') data.lastGift = new Date();
    if (event === 'recharge') data.lastRecharge = new Date();
    await this.prisma.aIHostMemory.update({ where: { id: row.id }, data });
  }

  private async finalizeCallMemory(
    userId: string,
    hostId: string,
    callId: string,
    durationSeconds: number,
  ) {
    const row = await this.ensureAIHostMemory(userId, hostId);
    const turns = await this.prisma.conversationHistory.findMany({
      where: { callId },
      orderBy: { timestamp: 'asc' },
      take: 20,
    });

    const summary = summarizeCallTurns(
      turns.map((t) => ({ userMessage: t.userMessage, aiReply: t.aiReply })),
    );

    let delta = relationshipScoreDelta('long_conversation', { callDurationSeconds: durationSeconds });
    if (isDailyCallStreak(row.lastCall)) delta += relationshipScoreDelta('daily_call');
    if (daysSince(row.lastCall) > 30) delta += relationshipScoreDelta('inactivity');

    await this.prisma.aIHostMemory.update({
      where: { id: row.id },
      data: {
        callCount: { increment: 1 },
        lastCall: new Date(),
        relationshipScore: clampRelationshipScore(row.relationshipScore + delta),
        memorySummary: summary || row.memorySummary,
      },
    });

    await this.prisma.virtualHostSession.updateMany({
      where: { callId },
      data: { conversationSummary: summary || undefined },
    });
  }
}