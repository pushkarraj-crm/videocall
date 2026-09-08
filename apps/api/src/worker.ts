import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  const logger = new Logger('Worker');
  logger.log('Background worker started (cron jobs + queue processors)');

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down worker');
    await app.close();
    process.exit(0);
  });
}

bootstrap();