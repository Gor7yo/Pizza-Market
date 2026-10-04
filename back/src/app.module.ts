import { randomUUID } from 'node:crypto';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OriginGuard } from './common/auth/origin.guard';
import { AppConfig } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { EmailModule } from './infrastructure/email/email.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisThrottlerStorage } from './infrastructure/redis/redis-throttler.storage';
import { RedisModule } from './infrastructure/redis/redis.module';
import { redisOptionsFromUrl, RedisService } from './infrastructure/redis/redis.service';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DevModule } from './modules/dev/dev.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { GeoModule } from './modules/geo/geo.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PromoModule } from './modules/promo/promo.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          // JSON logs in production/test (for log shippers), human-readable in development
          transport:
            config.get('NODE_ENV') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
              : undefined,
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const id =
              typeof incoming === 'string' && /^[\w-]{1,100}$/.test(incoming)
                ? incoming
                : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          // Secrets must never reach logs.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.newPassword',
              '*.currentPassword',
              '*.token',
              '*.refreshToken',
              '*.accessToken',
            ],
            censor: '[redacted]',
          },
          serializers: {
            // drop query strings (OAuth codes/state) from access logs
            req: (req: { id: unknown; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url.split('?')[0],
            }),
          },
          customLogLevel: (_req, res, err) =>
            err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
          autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: { ...redisOptionsFromUrl(config.get('REDIS_URL')), maxRetriesPerRequest: null },
        prefix: 'bull',
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(redis.client),
      }),
    }),
    EventEmitterModule.forRoot(),
    StorageModule,
    EmailModule,
    AuditModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    PricingModule,
    CartModule,
    PaymentsModule,
    OrdersModule,
    NotificationsModule,
    ReviewsModule,
    FavoritesModule,
    PromoModule,
    DashboardModule,
    GeoModule,
    MaintenanceModule,
    ConditionalModule.registerWhen(
      DevModule,
      (env: NodeJS.ProcessEnv) =>
        env.DEV_ENDPOINTS_ENABLED === 'true' && env.NODE_ENV !== 'production',
    ),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
