import { Injectable, MessageEvent } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import type { SerializedNotification } from '../../common/utils/notification-display';

export type NotificationStreamEvent =
  | { event: 'notification'; notification: SerializedNotification }
  | { event: 'unread_count'; count: number }
  | { event: 'heartbeat'; ts: string };

@Injectable()
export class NotificationEventsService {
  private readonly emitter = new EventEmitter();
  private readonly maxListeners = 500;

  constructor() {
    this.emitter.setMaxListeners(this.maxListeners);
  }

  private channel(userId: string) {
    return `notification:${userId}`;
  }

  emit(userId: string, payload: NotificationStreamEvent) {
    this.emitter.emit(this.channel(userId), payload);
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