import {
  Injectable,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import type { SerializedNotification } from '../../common/utils/notification-display';
import { RedisService } from '../../integrations/redis/redis.service';

export type NotificationStreamEvent =
  | { event: 'notification'; notification: SerializedNotification }
  | { event: 'unread_count'; count: number }
  | {
      event: 'incoming_call';
      callId: string;
      callerId: string;
      callerName: string;
      callerAvatarUrl: string | null;
    }
  | { event: 'call_status'; callId: string; status: string }
  | {
      event: 'call_gift';
      callId: string;
      gift: {
        id: string;
        giftId: string;
        quantity: number;
        coinCoins: number;
        hostEarningCoins: number;
        createdAt: string;
        sender: { id: string; displayName: string; avatarUrl: string | null };
        gift: {
          name: string;
          icon: string;
          animationTier: string;
          animationKey: string;
          category: string;
        };
      };
    }
  | { event: 'heartbeat'; ts: string };

@Injectable()
export class NotificationEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventsService.name);
  private readonly emitter = new EventEmitter();
  private readonly instanceId = randomUUID();
  private readonly maxListeners = 500;
  private subscriptionRetry: NodeJS.Timeout | null = null;

  constructor(private readonly redis: RedisService) {
    this.emitter.setMaxListeners(this.maxListeners);
  }

  async onModuleInit() {
    if (!this.redis.isEnabled) return;
    if (await this.subscribeToRedis()) return;

    this.logger.warn('Notification fan-out is local until Redis Pub/Sub is available');
    this.subscriptionRetry = setInterval(() => {
      void this.subscribeToRedis().then((subscribed) => {
        if (!subscribed || !this.subscriptionRetry) return;
        clearInterval(this.subscriptionRetry);
        this.subscriptionRetry = null;
        this.logger.log('Notification fan-out connected to Redis Pub/Sub');
      });
    }, 5_000);
    this.subscriptionRetry.unref();
  }

  onModuleDestroy() {
    if (this.subscriptionRetry) clearInterval(this.subscriptionRetry);
    this.subscriptionRetry = null;
  }

  private async subscribeToRedis() {
    if ((await this.redis.ping()) !== 'ok') return false;
    return this.redis.subscribePattern('notification:*', (channel, message) => {
      try {
        const envelope = JSON.parse(message) as {
          origin?: string;
          payload?: NotificationStreamEvent;
        };
        if (envelope.origin === this.instanceId || !envelope.payload) return;
        this.emitter.emit(channel, envelope.payload);
      } catch {
        this.logger.warn('Ignoring malformed notification event from Redis');
      }
    });
  }

  private channel(userId: string) {
    return `notification:${userId}`;
  }

  emit(userId: string, payload: NotificationStreamEvent) {
    const channel = this.channel(userId);
    this.emitter.emit(channel, payload);
    void this.redis.publish(
      channel,
      JSON.stringify({ origin: this.instanceId, payload }),
    );
  }

  subscribe(userId: string): Observable<MessageEvent> {
    const events$ = new Observable<MessageEvent>((subscriber) => {
      const handler = (payload: NotificationStreamEvent) => {
        subscriber.next({
          data: JSON.stringify(payload),
        } as MessageEvent);
      };

      this.emitter.on(this.channel(userId), handler);
      return () => this.emitter.off(this.channel(userId), handler);
    });

    const heartbeat$ = interval(30_000).pipe(
      map(
        () =>
          ({
            data: JSON.stringify({
              event: 'heartbeat',
              ts: new Date().toISOString(),
            } satisfies NotificationStreamEvent),
          }) as MessageEvent,
      ),
    );

    return merge(events$, heartbeat$);
  }
}
