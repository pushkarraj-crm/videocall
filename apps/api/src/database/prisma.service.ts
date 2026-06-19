import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.connected = true;
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      this.logger.warn(
        'Database unavailable at startup — API running in degraded mode until Postgres is reachable',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}