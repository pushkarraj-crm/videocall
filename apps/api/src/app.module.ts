import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './integrations/redis/redis.module';
import { RedisService } from './integrations/redis/redis.service';
import { RedisThrottlerStorage } from './integrations/redis/redis-throttler-storage';
import { AiHostAssetsModule } from './integrations/ai-host-assets/ai-host-assets.module';
import { StorageModule } from './integrations/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { HealthModule } from './modules/health/health.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { RiskModule } from './modules/risk/risk.module';
import { CallHistoryModule } from './modules/call-history/call-history.module';
import { CallsModule } from './modules/calls/calls.module';
import { HostsModule } from './modules/hosts/hosts.module';
import { KycModule } from './modules/kyc/kyc.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FollowsModule } from './modules/follows/follows.module';
import { GiftsModule } from './modules/gifts/gifts.module';
import { VirtualHostsModule } from './modules/virtual-hosts/virtual-hosts.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.token', 'req.body.code', 'res.headers.set-cookie'],
        serializers: {
          req: (request: { id?: string; method?: string; url?: string; headers?: Record<string, unknown> }) => ({
            id: request.id, method: request.method,
            url: request.url?.split('?')[0], headers: request.headers,
          }),
        },
        customProps: (req) => ({
          requestId: (req as { requestId?: string }).requestId,
        }),
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: process.env.NODE_ENV === 'production' ? 60_000 : 5000,
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    ...(process.env.ENABLE_CRON_JOBS !== 'false' ? [ScheduleModule.forRoot()] : []),
    RedisModule,
    StorageModule,
    AiHostAssetsModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    WalletModule,
    PaymentsModule,
    ReferralsModule,
    PromotionsModule,
    HostsModule,
    KycModule,
    CallsModule,
    CallHistoryModule,
    MessagingModule,
    NotificationsModule,
    CommunicationsModule,
    RiskModule,
    ReportsModule,
    ReviewsModule,
    FollowsModule,
    GiftsModule,
    VirtualHostsModule,
    ModerationModule,
    AdminModule,
    ComplianceModule,
    HealthModule,
    TasksModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
