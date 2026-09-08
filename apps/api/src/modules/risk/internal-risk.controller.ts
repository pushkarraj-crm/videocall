import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RiskEventType } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { InternalApiKeyGuard } from '../communications/guards/internal-api-key.guard';
import { RiskEngineService } from './risk-engine.service';
import { RiskQueueService } from './risk-queue.service';

@Public()
@UseGuards(InternalApiKeyGuard)
@Controller('internal/risk')
export class InternalRiskController {
  constructor(
    private readonly engine: RiskEngineService,
    private readonly queue: RiskQueueService,
  ) {}

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('evaluate')
  async evaluate(
    @Body()
    body: {
      userId: string;
      eventType: RiskEventType;
      ip?: string;
      fingerprint?: string;
      country?: string;
      city?: string;
      metadata?: Record<string, unknown>;
      async?: boolean;
      idempotencyKey?: string;
    },
  ) {
    if (body.async) {
      return this.queue.enqueue(
        body.eventType,
        {
          userId: body.userId,
          ip: body.ip,
          fingerprint: body.fingerprint,
          country: body.country,
          city: body.city,
          metadata: body.metadata,
        },
        body.idempotencyKey ?? `risk:${body.eventType}:${body.userId}:${Date.now()}`,
        body.userId,
      );
    }

    return this.engine.evaluate({
      userId: body.userId,
      eventType: body.eventType,
      ip: body.ip,
      fingerprint: body.fingerprint,
      country: body.country,
      city: body.city,
      metadata: body.metadata,
    });
  }
}