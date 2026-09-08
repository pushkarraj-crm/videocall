import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../integrations/redis/redis.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      if (!this.prisma.isConnected) await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  async checkRedis(): Promise<'ok' | 'error' | 'disabled'> {
    return this.redis.ping();
  }

  async checkStorage(): Promise<'ok' | 'configured'> {
    const provider = this.config.get<string>('STORAGE_PROVIDER', 'local');
    return provider === 'local' ? 'ok' : 'configured';
  }

  async checkQueues(): Promise<'ok' | 'degraded'> {
    const db = await this.checkDatabase();
    if (db !== 'ok') return 'degraded';
    const redis = await this.checkRedis();
    if (redis === 'error') return 'degraded';
    return 'ok';
  }

  async getReadiness() {
    const [database, redis, storage, queues] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
      this.checkQueues(),
    ]);

    const ready =
      database === 'ok' &&
      (redis === 'ok' || redis === 'disabled') &&
      queues === 'ok';

    return {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: { database, redis, storage, queues },
    };
  }

  async getMetrics() {
    const [activeUsers, activeHosts, pendingWithdrawals] = await Promise.all([
      this.prisma.user.count({
        where: { status: 'active', lastSeenAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
      }),
      this.prisma.hostProfile.count({
        where: { OR: [{ isOnline: true }, { isBusy: true }] },
      }),
      this.prisma.withdrawal.count({ where: { status: 'requested' } }),
    ]);

    return {
      timestamp: new Date().toISOString(),
      activeUsers,
      activeHosts,
      pendingWithdrawals,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
  }
}