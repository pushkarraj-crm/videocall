import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
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

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}