import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
const cookieParser = require('cookie-parser');

import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true, // needed for Stripe webhook signature verification
  });

  // ── Security ───────────────────────────────────────────────────────────────
  app.use(helmet());

  // ── Cookie parser (required for httpOnly refresh_token cookie) ────────────
  app.use(cookieParser());

  // ── CORS ───────────────────────────────────────────────────────────────────
  const corsOrigins = (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'Retry-After',
    ],
    credentials: true,
    maxAge: 86400,
  });

  // ── Global prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Global pipes ──────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global filters ────────────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Global interceptors (order: RequestId → Logging → Transform) ──────────
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ── Swagger (disabled in production) ──────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('MapleLoomHandmade API')
      .setDescription(
        'REST API for MapleLoomHandmade — personalized gifts e-commerce',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addCookieAuth('refresh_token')
      .addTag('Auth', 'Authentication & authorization')
      .addTag('Users', 'User profile & addresses')
      .addTag('Products', 'Product catalog')
      .addTag('Catalog', 'Categories & collections')
      .addTag('Cart', 'Shopping cart')
      .addTag('Orders', 'Order management')
      .addTag('Payments', 'Payment processing')
      .addTag('Shipping', 'Shipping zones & rates')
      .addTag('Reviews', 'Product reviews')
      .addTag('Promotions', 'Discount codes')
      .addTag('Search', 'Full-text product search')
      .addTag('Admin', 'Admin-only endpoints')
      .addTag('Webhooks', 'Stripe & PayPal webhooks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    Logger.log('Swagger docs → http://localhost:3002/api/docs', 'Bootstrap');
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT ?? '3002', 10);
  await app.listen(port);

  Logger.log(`API running on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(
    `Environment: ${process.env.NODE_ENV ?? 'development'}`,
    'Bootstrap',
  );
}

bootstrap();
