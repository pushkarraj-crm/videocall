import 'reflect-metadata';
import { initSentry } from './config/sentry';

initSentry();

// Prisma returns BigInt for coin fields; JSON.stringify cannot serialize them natively.
if (!(BigInt.prototype as { toJSON?: () => string }).toJSON) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function toJSON(this: bigint) {
      return this.toString();
    },
    writable: true,
    configurable: true,
  });
}

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp?.set === 'function') {
    expressApp.set('trust proxy', 1);
  }
  app.use(helmet());
  app.use(compression());

  const corsOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.setGlobalPrefix(config.get<string>('API_PREFIX', 'v1'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('PORT', 3001);
  const prefix = config.get<string>('API_PREFIX', 'v1');
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}/${prefix}`);
  logger.log(`Mapped {/${prefix}/auth/dev-login, POST} route`);
  logger.log(`Dev auth enabled: ${config.get<string>('ENABLE_DEV_AUTH') === 'true'}`);
}

bootstrap();