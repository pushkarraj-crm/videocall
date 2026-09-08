import { Injectable, Logger } from '@nestjs/common';
import {
  FraudFlagStatus,
  FraudFlagType,
  Prisma,
  RiskEventType,
  RiskLevel,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RiskActionsService } from './risk-actions.service';
import { EvaluationContext, RiskRulesService } from './risk-rules.service';
import { mergeScores, scoreToRiskLevel } from './utils/risk-score';

export interface RiskEvaluationResult {
  score: number;
  level: RiskLevel;
  hits: Array<{ ruleId: string; score: number; reason: string }>;
  eventId?: string;
  flagged: boolean;
}

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RiskRulesService,
    private readonly actions: RiskActionsService,
  ) {}

  async evaluate(ctx: EvaluationContext): Promise<RiskEvaluationResult> {
    const hits = await this.rules.evaluate(ctx);
    const score = mergeScores(hits.map((h) => h.score));
    const level = scoreToRiskLevel(score);

    if (hits.length === 0 && score === 0) {
      return { score: 0, level: RiskLevel.low, hits: [], flagged: false };
    }

    const primary = hits.sort((a, b) => b.score - a.score)[0];
    const reason = hits.map((h) => h.reason).join('; ').slice(0, 500);

    const event = await this.prisma.riskEvent.create({
      data: {
        userId: ctx.userId,
        eventType: ctx.eventType,
        riskScore: score,
        riskLevel: level,
        reason: reason || primary?.reason || 'Risk evaluation',
        ruleId: primary?.ruleId,
        metadata: (ctx.metadata ?? {}) as unknown as Prisma.InputJsonValue,
        ipAddress: ctx.ip,
        fingerprint: ctx.fingerprint,
        country: ctx.country,
        city: ctx.city,
      },
    });

    await this.actions.updateProfile(ctx.userId, score, level, {
      country: ctx.country,
      ip: ctx.ip,
    });

    let flagged = false;
    for (const hit of hits) {
      if (!hit.flagType || hit.score < 26) continue;
      await this.actions.createFlagIfNeeded(ctx.userId, hit.flagType, hit.ruleId, hit.score, hit.reason);
      flagged = true;
    }

    if (level === RiskLevel.high || level === RiskLevel.critical) {
      await this.actions.applyAutomaticActions(ctx.userId, level);
      flagged = true;
    }

    await this.prisma.riskDecisionAudit.create({
      data: {
        userId: ctx.userId,
        action: 'risk.evaluate',
        ruleId: primary?.ruleId,
        riskScore: score,
        details: { hits, level, eventId: event.id } as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.debug(`Risk ${ctx.eventType} user=${ctx.userId} score=${score} level=${level}`);

    return {
      score,
      level,
      hits: hits.map((h) => ({ ruleId: h.ruleId, score: h.score, reason: h.reason })),
      eventId: event.id,
      flagged,
    };
  }

  async hasOpenFlag(userId: string, type?: FraudFlagType) {
    return this.prisma.fraudFlag.findFirst({
      where: {
        userId,
        status: { in: [FraudFlagStatus.open, FraudFlagStatus.reviewing] },
        ...(type ? { type } : {}),
      },
    });
  }
}