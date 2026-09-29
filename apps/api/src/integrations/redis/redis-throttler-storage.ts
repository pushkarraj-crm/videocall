import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

interface LocalRateLimitRecord {
  totalHits: number;
  expiresAt: number;
  blockExpiresAt: number;
  isBlocked: boolean;
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly localRecords = new Map<string, LocalRateLimitRecord>();
  private readonly cleanupTimer = setInterval(() => this.removeExpiredRecords(), 60_000);

  constructor(private readonly redis: RedisService) {
    this.cleanupTimer.unref();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    const shared = await this.redis.incrementRateLimit(
      `${throttlerName}:${key}`,
      ttl,
      limit,
      blockDuration,
    );
    if (shared) return shared;

    return this.incrementLocally(`${throttlerName}:${key}`, ttl, limit, blockDuration);
  }

  onApplicationShutdown() {
    clearInterval(this.cleanupTimer);
    this.localRecords.clear();
  }

  private incrementLocally(key: string, ttl: number, limit: number, blockDuration: number) {
    const now = Date.now();
    let record = this.localRecords.get(key);

    if (record?.isBlocked && record.blockExpiresAt > now) {
      return {
        totalHits: record.totalHits,
        timeToExpire: Math.max(0, Math.ceil((record.expiresAt - now) / 1000)),
        isBlocked: true,
        timeToBlockExpire: Math.max(0, Math.ceil((record.blockExpiresAt - now) / 1000)),
      };
    }

    if (!record || record.expiresAt <= now || record.isBlocked) {
      record = {
        totalHits: 0,
        expiresAt: now + ttl,
        blockExpiresAt: 0,
        isBlocked: false,
      };
    }

    record.totalHits += 1;
    if (record.totalHits > limit) {
      record.isBlocked = true;
      record.blockExpiresAt = now + blockDuration;
    }
    this.localRecords.set(key, record);

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.max(0, Math.ceil((record.expiresAt - now) / 1000)),
      isBlocked: record.isBlocked,
      timeToBlockExpire: Math.max(0, Math.ceil((record.blockExpiresAt - now) / 1000)),
    };
  }

  private removeExpiredRecords() {
    const now = Date.now();
    for (const [key, record] of this.localRecords) {
      if (record.expiresAt <= now && record.blockExpiresAt <= now) {
        this.localRecords.delete(key);
      }
    }
  }
}
