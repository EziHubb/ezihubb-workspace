import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import jwtConfig from '../config/jwt.config';
import redisConfig from '../config/redis.config';
import storageConfig from '../config/storage.config';
import emailConfig from '../config/email.config';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { ProductsModule } from '../modules/products/products.module';
import { CartModule } from '../modules/cart/cart.module';
import { OrdersModule } from '../modules/orders/orders.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { ShippingModule } from '../modules/shipping/shipping.module';
import { ReviewsModule } from '../modules/reviews/reviews.module';
import { PromotionsModule } from '../modules/promotions/promotions.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { CustomizationModule } from '../modules/customization/customization.module';
import { SearchModule } from '../modules/search/search.module';
import { AdminModule } from '../modules/admin/admin.module';
import { HealthModule } from '../health/health.module';
import { MongoDBModule } from '../modules/database/mongodb.module';
import { AssetsModule } from '../modules/assets/assets.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { MessagesModule } from '../modules/messages/messages.module';

@Module({
  imports: [
    // ── Config (global, validated) ───────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, storageConfig, emailConfig],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3002),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
        CORS_ORIGINS: Joi.string().default('http://localhost:3000,http://localhost:3001'),
        // Storage — optional during development
        AWS_S3_BUCKET: Joi.string().default('mlh-assets'),
        AWS_S3_REGION: Joi.string().default('auto'),
        AWS_ACCESS_KEY_ID: Joi.string().optional(),
        AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
        CDN_URL: Joi.string().optional(),
        // Stripe — optional during development
        STRIPE_SECRET_KEY: Joi.string().optional(),
        STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
        // Email — optional during development
        SMTP_HOST: Joi.string().optional(),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().optional(),
        SMTP_PASS: Joi.string().optional(),
        EMAIL_FROM: Joi.string().email().default('noreply@mapleloomhandmade.com'),
        // Google OAuth — optional during development
        GOOGLE_CLIENT_ID: Joi.string().optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().optional(),
        GOOGLE_CALLBACK_URL: Joi.string().optional(),
        FRONTEND_URL: Joi.string().default('http://localhost:3000'),
        // MongoDB — optional (falls back to localhost in development)
        MONGODB_URI: Joi.string().default('mongodb://localhost:27017'),
      }),
      validationOptions: { abortEarly: false },
    }),

    // ── Rate limiting (default: 100 req / 60s) ────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
      }),
      inject: [ConfigService],
    }),

    // ── BullMQ / DevBullModule ─────────────────────────────────────────────────
    // When Redis is unavailable (DISABLE_QUEUE=true), DevBullModule provides no-op
    // queue stubs so the HTTP API starts without blocking on Redis connections.
    ...(process.env['DISABLE_QUEUE'] !== 'true'
      ? [BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => {
            const u = new URL(config.get<string>('redis.url') ?? 'redis://localhost:6379');
            return { connection: { host: u.hostname, port: parseInt(u.port || '6379', 10), ...(u.password ? { password: decodeURIComponent(u.password) } : {}), ...(u.protocol === 'rediss:' ? { tls: {} } : {}) } };
          },
          inject: [ConfigService],
        })]
      : []),

    // ── Infrastructure ──────────────────────────────────────────
    PrismaModule,
    MongoDBModule,
    CommonModule,
    QueueModule,

    // ── Feature modules ───────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    CatalogModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    ShippingModule,
    ReviewsModule,
    PromotionsModule,
    NotificationsModule,
    CustomizationModule,
    SearchModule,
    AdminModule,
    AssetsModule,
    AnalyticsModule,
    MessagesModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
