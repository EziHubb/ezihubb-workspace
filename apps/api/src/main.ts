import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as https from 'https';
const cookieParser = require('cookie-parser');

import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// ── MongoDB SRV resolution via DNS-over-HTTPS ─────────────────────────────────
// UDP port 53 (regular DNS) may be blocked; DoH uses HTTPS (port 443) instead.
// Resolves the Atlas SRV record and rewrites MONGODB_URI to a direct connection
// string so Mongoose never needs to do SRV DNS resolution itself.

function dohFetch(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { accept: 'application/dns-json' } }, (res) => {
      let data = '';
      res.on('data', (c: Buffer) => (data += c.toString()));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function resolveMongoSrvUri(originalUri: string): Promise<string> {
  if (!originalUri.startsWith('mongodb+srv://')) return originalUri;
  try {
    const url  = new URL(originalUri.replace('mongodb+srv://', 'https://'));
    const host = url.hostname;

    const [srvResp, txtResp] = await Promise.all([
      dohFetch(`https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`),
      dohFetch(`https://dns.google/resolve?name=${host}&type=TXT`),
    ]);

    const srvAnswers = ((srvResp['Answer'] ?? []) as { type: number; data: string }[])
      .filter((r) => r.type === 33);
    if (!srvAnswers.length) return originalUri;

    const hosts = srvAnswers.map((r) => {
      const parts = r.data.trim().split(/\s+/);
      return `${parts[3].replace(/\.$/, '')}:${parts[2]}`;
    }).join(',');

    const txtAnswers = ((txtResp['Answer'] ?? []) as { type: number; data: string }[])
      .filter((r) => r.type === 16);
    const txtOptions = txtAnswers.map((r) => r.data.replace(/^"|"$/g, '').replace(/"\s*"/g, '')).join('&')
      || 'authSource=admin';

    const creds   = `${url.username}:${encodeURIComponent(decodeURIComponent(url.password))}`;
    const extraQs = url.search ? url.search.slice(1) : '';
    const qs      = [txtOptions, 'tls=true', extraQs].filter(Boolean).join('&');
    const direct  = `mongodb://${creds}@${hosts}/?${qs}`;
    Logger.log(`MongoDB SRV resolved via DoH → ${hosts.split(',')[0]}`, 'Bootstrap');
    return direct;
  } catch (e) {
    Logger.warn(`MongoDB DoH SRV resolution failed: ${(e as Error).message} — using original URI`, 'Bootstrap');
    return originalUri;
  }
}

async function bootstrap() {
  // Pre-resolve MongoDB SRV before NestJS initialises (avoids OS DNS failure)
  const rawMongoUri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  process.env['MONGODB_URI'] = await resolveMongoSrvUri(rawMongoUri);

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true, // needed for Stripe webhook signature verification
  });

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,     // Stripe Elements requires this off
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", 'https://js.stripe.com', 'https://www.paypal.com',
                      'https://static.hotjar.com', 'https://script.hotjar.com'],
        frameSrc:    ["'self'", 'https://js.stripe.com', 'https://www.paypal.com',
                      'https://vars.hotjar.com'],
        imgSrc:      ["'self'", 'data:', 'https://pub-dcb46924f84546899f1a823b152eab3a.r2.dev',
                      'https://images.unsplash.com', 'https://*.hotjar.com'],
        connectSrc:  ["'self'", 'https://api.stripe.com',
                      'https://vc.hotjar.io', 'https://events.hotjar.io'],
      },
    },
  }));

  // ── Cookie parser (required for httpOnly refresh_token cookie) ────────────
  app.use(cookieParser());

  // ── CORS ───────────────────────────────────────────────────────────────────
  // CORS_ORIGINS="*" → reflect any origin (dev); comma-list → strict whitelist
  const rawOrigins = process.env['CORS_ORIGINS'] ?? 'http://localhost:3000,http://localhost:3001';
  const allowAll   = rawOrigins.trim() === '*';
  const originList = allowAll ? [] : rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: allowAll
      ? true
      : (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
          if (!origin || originList.includes(origin)) cb(null, true);
          else cb(new Error(`CORS: origin ${origin} not allowed`));
        },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID'],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'Retry-After',
    ],
    credentials: true,
    maxAge: 86400,
  });

  Logger.log(
    allowAll ? 'CORS: all origins allowed' : `CORS: ${originList.join(', ')}`,
    'Bootstrap',
  );

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

// Prevent Redis connection-closed errors from crashing the process.
// BullMQ/ioredis emits this when Redis is unavailable; HTTP server stays up.
process.on('uncaughtException', (error: Error) => {
  if (
    error.message === 'Connection is closed.' ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('querySrv')
  ) {
    Logger.warn(`[Queue/DB] Non-fatal connection error: ${error.message}`, 'Bootstrap');
    return;
  }
  Logger.error('Uncaught exception — exiting', error.stack, 'Bootstrap');
  process.exit(1);
});
