import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { getAllowedOrigins, getConfiguredOrigins, isWildcardOrigin } from './allowed-origins.util';

/** Shared bootstrap/test policy; CORS does not replace OriginCheckGuard CSRF checks. */
export function apiCorsOptions(): CorsOptions {
  const allowAllOrigins = isWildcardOrigin(getConfiguredOrigins());
  if (allowAllOrigins && process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGINS="*" is not allowed in production — set an explicit whitelist.');
  }
  const allowedOrigins = getAllowedOrigins();
  return {
    // Denial must not forward an Error to Express and become an unrelated 500.
    origin: allowAllOrigins ? true : (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID', 'X-Store-Context', 'X-Locale'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400,
  };
}
