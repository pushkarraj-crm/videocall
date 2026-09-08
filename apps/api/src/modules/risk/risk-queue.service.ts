import { Injectable } from '@nestjs/common';
import { Prisma, RiskEventType, RiskQueueStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RiskEngineService } from './risk-engine.service';

const BATCH = 20;

@Injectable()
export class RiskQueueService {
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: RiskEngineService,
  ) {}

  async enqueue(
    eventType: RiskEventType,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    userId?: string,
  ) {
    try {
      await this.prisma.riskQueueItem.create({
        data: {
          userId,
          eventType,
          payload: payload as unknown as Prisma.InputJsonValue,
          idempotencyKey,
        },
      });
      return { queued: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { queued: false, duplicate: true };
      }
      throw err;
    }
  }

  async processQueue() {
    if (this.processing) return { processed: 0 };
    this.processing = true;
    try {
      const items = await this.prisma.riskQueueItem.findMany({
        where: { status: RiskQueueStatus.pending },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
      });

      let processed = 0;
      for (const item of items) {
        await this.prisma.riskQueueItem.update({
          where: { id: item.id },
          data: { status: RiskQueueStatus.processing },
        });

        try {
          const payload = item.payload as Record<string, unknown>;
          const userId = (payload.userId as string) ?? item.userId;
          if (!userId) throw new Error('Missing userId');

          await this.engine.evaluate({
            userId,
            eventType: item.eventType,
            ip: payload.ip as string | undefined,
            fingerprint: payload.fingerprint as string | undefined,
            country: payload.country as string | undefined,
            city: payload.city as string | undefined,
            metadata: payload.metadata as Record<string, unknown> | undefined,
          });

          await this.prisma.riskQueueItem.update({
            where: { id: item.id },
            data: { status: RiskQueueStatus.completed, processedAt: new Date() },
          });
          processed++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Risk queue failed';
          await this.prisma.riskQueueItem.update({
            where: { id: item.id },
            data: {
              status: RiskQueueStatus.failed,
              attempts: item.attempts + 1,
              lastError: message.slice(0, 500),
              processedAt: new Date(),
            },
          });
        }
      }
      return { processed };
    } finally {
      this.processing = false;
    }
  }
}