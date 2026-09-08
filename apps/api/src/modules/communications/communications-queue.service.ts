import { Injectable, Logger } from '@nestjs/common';
import {
  CommunicationChannel,
  CommunicationEventType,
  CommunicationLogStatus,
  CommunicationQueueStatus,
  Prisma,
} from '@prisma/client';
import { APP_TITLE } from '../../common/utils/app-brand';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationProviderFactory } from './providers/provider.factory';
import { nextRetryAt } from './utils/retry-backoff';

const BATCH_SIZE = 25;

export interface EnqueueParams {
  userId?: string;
  campaignId?: string;
  channel: CommunicationChannel;
  eventType: CommunicationEventType;
  recipient: string;
  subject?: string;
  body: string;
  htmlBody?: string;
  templateKey: string;
  templateId?: string;
  templateData?: Record<string, string>;
  idempotencyKey: string;
  referenceId?: string;
  referenceType?: string;
}

@Injectable()
export class CommunicationsQueueService {
  private readonly logger = new Logger(CommunicationsQueueService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: CommunicationProviderFactory,
  ) {}

  async enqueue(params: EnqueueParams) {
    try {
      const item = await this.prisma.communicationQueueItem.create({
        data: {
          userId: params.userId,
          campaignId: params.campaignId,
          channel: params.channel,
          eventType: params.eventType,
          recipient: params.recipient,
          subject: params.subject,
          body: params.body,
          htmlBody: params.htmlBody,
          templateKey: params.templateKey,
          templateData: (params.templateData ?? {}) as unknown as Prisma.InputJsonValue,
          idempotencyKey: params.idempotencyKey,
          referenceId: params.referenceId,
          referenceType: params.referenceType,
        },
      });

      await this.prisma.communicationLog.create({
        data: {
          userId: params.userId,
          campaignId: params.campaignId,
          queueItemId: item.id,
          templateId: params.templateId,
          channel: params.channel,
          eventType: params.eventType,
          template: params.templateKey,
          recipient: params.recipient,
          subject: params.subject,
          status: CommunicationLogStatus.queued,
        },
      });

      return { queued: true, id: item.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { queued: false, duplicate: true };
      }
      throw err;
    }
  }

  async processQueue() {
    if (this.processing) return { processed: 0, skipped: true };
    this.processing = true;

    try {
      const now = new Date();
      const items = await this.prisma.communicationQueueItem.findMany({
        where: {
          status: { in: [CommunicationQueueStatus.pending, CommunicationQueueStatus.failed] },
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      let processed = 0;
      for (const item of items) {
        const done = await this.processItem(item);
        if (done) processed++;
      }
      return { processed };
    } finally {
      this.processing = false;
    }
  }

  private async processItem(item: {
    id: string;
    userId: string | null;
    campaignId: string | null;
    channel: CommunicationChannel;
    eventType: CommunicationEventType;
    recipient: string;
    subject: string | null;
    body: string;
    htmlBody: string | null;
    templateKey: string;
    attempts: number;
    maxAttempts: number;
  }): Promise<boolean> {
    const id = item.id;
    const claimed = await this.prisma.communicationQueueItem.updateMany({
      where: {
        id,
        status: { in: [CommunicationQueueStatus.pending, CommunicationQueueStatus.failed] },
      },
      data: { status: CommunicationQueueStatus.processing },
    });
    if (claimed.count === 0) return false;

    const attempts = item.attempts + 1;

    try {
      const result =
        item.channel === CommunicationChannel.email
          ? await this.providers.sendEmail({
              to: item.recipient,
              subject: item.subject ?? APP_TITLE,
              text: item.body,
              html: item.htmlBody ?? undefined,
            })
          : await this.providers.sendSms({
              to: item.recipient,
              body: item.body,
              unicode: [...item.body].some((char) => char.charCodeAt(0) > 127),
            });

      if (!result.success) {
        await this.handleFailure(item, attempts, result.error ?? 'Provider send failed', item);
        return false;
      }

      await this.prisma.$transaction([
        this.prisma.communicationQueueItem.update({
          where: { id },
          data: {
            status: CommunicationQueueStatus.sent,
            attempts,
            processedAt: new Date(),
            lastError: null,
          },
        }),
        this.prisma.communicationLog.updateMany({
          where: { queueItemId: id },
          data: {
            status: CommunicationLogStatus.sent,
            provider: result.provider,
            providerId: result.providerId,
            providerResponse: (result.response ?? {}) as unknown as Prisma.InputJsonValue,
            retryCount: attempts - 1,
            deliveredAt: new Date(),
            template: item.templateKey,
          },
        }),
      ]);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Queue processing failed';
      await this.handleFailure(item, attempts, message, item);
      return false;
    }
  }

  private async handleFailure(
    item: { id: string; attempts: number; maxAttempts: number },
    attempts: number,
    error: string,
    deadLetterCtx?: {
      id: string;
      userId: string | null;
      campaignId: string | null;
      channel: CommunicationChannel;
      eventType: CommunicationEventType;
      recipient: string;
      subject: string | null;
      templateKey?: string;
    },
  ) {
    const isDead = attempts >= item.maxAttempts;
    await this.prisma.communicationQueueItem.update({
      where: { id: item.id },
      data: {
        status: isDead ? CommunicationQueueStatus.dead_letter : CommunicationQueueStatus.failed,
        attempts,
        lastError: error.slice(0, 500),
        nextRetryAt: isDead ? null : nextRetryAt(attempts),
        processedAt: isDead ? new Date() : null,
      },
    });

    if (deadLetterCtx) {
      const updated = await this.prisma.communicationLog.updateMany({
        where: { queueItemId: deadLetterCtx.id },
        data: {
          status: CommunicationLogStatus.failed,
          failedAt: new Date(),
          bounceReason: error.slice(0, 500),
          retryCount: attempts,
        },
      });

      if (updated.count === 0 && isDead) {
        await this.prisma.communicationLog.create({
          data: {
            userId: deadLetterCtx.userId,
            campaignId: deadLetterCtx.campaignId,
            queueItemId: deadLetterCtx.id,
            channel: deadLetterCtx.channel,
            eventType: deadLetterCtx.eventType,
            template: deadLetterCtx.templateKey,
            recipient: deadLetterCtx.recipient,
            subject: deadLetterCtx.subject,
            status: CommunicationLogStatus.failed,
            failedAt: new Date(),
            bounceReason: error.slice(0, 500),
            retryCount: attempts,
          },
        }).catch(() => {
          this.logger.warn(`Dead letter log skipped for ${deadLetterCtx.id}`);
        });
      }
    }
  }
}