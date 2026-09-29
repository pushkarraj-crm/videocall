import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitIncrement {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const INCREMENT_RATE_LIMIT_SCRIPT = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or '0'), redis.call('PTTL', KEYS[1]), blockedTtl, 1 }
end

local currentHits = tonumber(redis.call('GET', KEYS[1]) or '0')
if currentHits > tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end

local windowTtl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, windowTtl, tonumber(ARGV[3]), 1 }
end

return { hits, windowTtl, 0, 0 }
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private readonly patternHandlers = new Map<
    string,
    (channel: string, message: string) => void
  >();
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    this.enabled = Boolean(url);
    if (url) {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
    }
  }

  get isEnabled() {
    return this.enabled;
  }

  async connect() {
    if (!this.client) return false;
    if (this.client.status === 'ready') return true;
    await this.client.connect();
    return true;
  }

  async ping(): Promise<'ok' | 'error' | 'disabled'> {
    if (!this.client) return 'disabled';
    try {
      const res = await this.client.ping();
      return res === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }

  async get(key: string) {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string) {
    if (!this.client) return;
    await this.client.del(key);
  }

  async incrementRateLimit(
    key: string,
    ttlMs: number,
    limit: number,
    blockDurationMs: number,
  ): Promise<RateLimitIncrement | null> {
    if (!this.client) return null;

    try {
      if (this.client.status === 'wait') await this.client.connect();
      if (this.client.status !== 'ready') return null;

      const result = (await this.client.eval(
        INCREMENT_RATE_LIMIT_SCRIPT,
        2,
        `platform:throttle:${key}`,
        `platform:throttle:blocked:${key}`,
        ttlMs,
        limit,
        blockDurationMs,
      )) as [number, number, number, number];

      return {
        totalHits: Number(result[0]),
        timeToExpire: Math.max(0, Math.ceil(Number(result[1]) / 1000)),
        timeToBlockExpire: Math.max(0, Math.ceil(Number(result[2]) / 1000)),
        isBlocked: Number(result[3]) === 1,
      };
    } catch {
      return null;
    }
  }

  async publish(channel: string, message: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      if (this.client.status === 'wait') await this.client.connect();
      if (this.client.status !== 'ready') return false;
      await this.client.publish(channel, message);
      return true;
    } catch {
      return false;
    }
  }

  async subscribePattern(
    pattern: string,
    handler: (channel: string, message: string) => void,
  ): Promise<boolean> {
    if (!this.client) return false;

    try {
      if (!this.subscriber) {
        this.subscriber = this.client.duplicate({ lazyConnect: true });
        this.subscriber.on('error', (err) =>
          this.logger.warn(`Redis subscriber error: ${err.message}`),
        );
        this.subscriber.on('pmessage', (matchedPattern, channel, message) => {
          this.patternHandlers.get(matchedPattern)?.(channel, message);
        });
      }

      this.patternHandlers.set(pattern, handler);
      if (this.subscriber.status === 'wait') await this.subscriber.connect();
      if (this.subscriber.status !== 'ready') return false;
      await this.subscriber.psubscribe(pattern);
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await Promise.all([
      this.client?.quit(),
      this.subscriber?.quit(),
    ].filter((promise): promise is Promise<'OK'> => Boolean(promise)));
    this.patternHandlers.clear();
  }
}
