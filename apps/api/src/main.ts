import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as https from 'https';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as Sentry from '@sentry/node';
const cookieParser = require('cookie-parser');

import { AppModule } from './app/app.module';
import { PartnerCatalogModule } from './modules/partner-api/partner-catalog.module';
import { ScopedValidationPipe } from './common/pipes/scoped-validation.pipe';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { getConfiguredOrigins, isWildcardOrigin, getAllowedOrigins } from './common/utils/allowed-origins.util';
import { AxiomLoggerService } from './common/services/axiom-logger.service';

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
  // ── Error monitoring ───────────────────────────────────────────────────────
  // Must run before anything else can throw, so early bootstrap errors are captured too.
  if (process.env['SENTRY_DSN']) {
    Sentry.init({
      dsn: process.env['SENTRY_DSN'],
      environment: process.env['NODE_ENV'] ?? 'development',
      tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 0,
    });
    Logger.log('Sentry error monitoring enabled', 'Bootstrap');
  }

  // Pre-resolve MongoDB SRV before NestJS initialises (avoids OS DNS failure)
  const rawMongoUri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
  process.env['MONGODB_URI'] = await resolveMongoSrvUri(rawMongoUri);

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true, // needed for Stripe webhook signature verification
  });
  app.useLogger(new AxiomLoggerService());
  if (process.env['AXIOM_TOKEN']) {
    Logger.log(`Axiom log shipping enabled (dataset: ${process.env['AXIOM_DATASET'] || 'ezihubb-dev'})`, 'Bootstrap');
  }

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,     // Stripe Elements requires this off
    // Helmet's default "same-origin" COOP would sever window.opener the
    // moment the Google OAuth popup navigates through this API's own origin
    // (api.ezihubb.com, different origin than ezihubb.com) — breaking the
    // client's popup-based sign-in flow, which relies on postMessage back to
    // the opener from the callback page after the redirect chain lands back
    // on the client's origin.
    crossOriginOpenerPolicy: false,
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
  // CORS_ORIGINS is a comma-separated whitelist (see .env.example). APP_URL and
  // ADMIN_URL are always included since they're this deployment's own first-party
  // frontends. "*" disables the whitelist and reflects any origin — combined with
  // credentials:true that is equivalent to no CORS protection at all, so it's only
  // tolerated outside production (and logged loudly either way).
  const allowAllOrigins = isWildcardOrigin(getConfiguredOrigins());
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (allowAllOrigins && nodeEnv === 'production') {
    throw new Error(
      'CORS_ORIGINS="*" is not allowed in production — set it to an explicit comma-separated whitelist (see .env.example).',
    );
  }

  const allowedOrigins = getAllowedOrigins();

  app.enableCors({
    origin: allowAllOrigins
      ? true
      : (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // No Origin header (server-to-server, curl, same-origin) — allow.
          if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`), false);
          }
        },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID', 'X-Store-Context', 'X-Locale'],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'Retry-After',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });

  Logger.log(
    allowAllOrigins
      ? 'CORS: all origins allowed (reflect mode) — CORS_ORIGINS="*", non-production only'
      : `CORS: restricted to [${[...allowedOrigins].join(', ')}]`,
    'Bootstrap',
  );

  // ── Global prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Global pipes ──────────────────────────────────────────────────────────
  // Strict for bodies, forgiving for query strings in production only.
  // The asymmetry is deliberate and explained in the pipe itself and in
  // docs/validation-pipe.md — do not collapse it back into one setting.
  app.useGlobalPipes(new ScopedValidationPipe());

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
      .setTitle('EziHubb API')
      .setDescription(
        'REST API for EziHubb — personalized gifts e-commerce',
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

  // ── Partner API docs (public, enabled in every environment) ───────────────
  // Separate document from the internal one above — 3rd-party integrators need
  // real production docs, not just dev-only internal API docs.
  const partnerConfig = new DocumentBuilder()
    .setTitle('EziHubb Partner API')
    .setDescription(
      'Public REST API for 3rd-party tools to manage a seller\'s own product catalog. ' +
      'Authenticate with an API key issued from Settings → API Keys, sent in the X-Api-Key header.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'X-Api-Key', in: 'header' },
      'apiKey',
    )
    .addTag('Partner API - Products', 'Create, update, list, and delete products in your store')
    .addTag('Partner API - Search', 'Search products in your store')
    .build();

  const partnerDocument = SwaggerModule.createDocument(app, partnerConfig, {
    include: [PartnerCatalogModule],
  });

  // Machine-readable spec stays available for codegen/tooling; humans get the
  // custom-styled reference page below instead of the default Swagger UI.
  app.getHttpAdapter().get('/partner/openapi.json', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json(partnerDocument);
  });

  const partnerDocsHtml = readFileSync(join(__dirname, 'assets', 'partner-docs.html'), 'utf8');
  app.getHttpAdapter().get('/partner/docs', (_req: unknown, res: { type: (t: string) => { send: (body: string) => void } }) => {
    res.type('html').send(partnerDocsHtml);
  });

  Logger.log(`Partner API docs → http://localhost:${process.env.PORT ?? '3002'}/partner/docs`, 'Bootstrap');

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
