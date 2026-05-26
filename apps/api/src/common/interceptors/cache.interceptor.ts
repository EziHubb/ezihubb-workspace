import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../services/redis.service';

export const CACHE_TTL_KEY = 'cache_ttl';
export const CACHE_KEY_PREFIX = 'cache_key_prefix';

/** Mark a route for Redis caching: @CacheTTL(60) @CacheKey('products:list') */
export const CacheTTL = (seconds: number) =>
  (target: object, key?: string | symbol, descriptor?: TypedPropertyDescriptor<unknown>) => {
    if (descriptor) {
      Reflect.defineMetadata(CACHE_TTL_KEY, seconds, descriptor.value as object);
    } else {
      Reflect.defineMetadata(CACHE_TTL_KEY, seconds, target);
    }
    return descriptor;
  };

export const CacheKey = (prefix: string) =>
  (target: object, key?: string | symbol, descriptor?: TypedPropertyDescriptor<unknown>) => {
    if (descriptor) {
      Reflect.defineMetadata(CACHE_KEY_PREFIX, prefix, descriptor.value as object);
    } else {
      Reflect.defineMetadata(CACHE_KEY_PREFIX, prefix, target);
    }
    return descriptor;
  };

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const ttl = this.reflector.get<number>(CACHE_TTL_KEY, context.getHandler());
    if (!ttl) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET') return next.handle();

    const keyPrefix =
      this.reflector.get<string>(CACHE_KEY_PREFIX, context.getHandler()) ?? req.url;
    const cacheKey = `cache:${keyPrefix}:${req.url}`;

    try {
      const cached = await this.redis.get<unknown>(cacheKey);
      if (cached !== null) {
        this.logger.debug(`Cache HIT: ${cacheKey}`);
        return of(cached);
      }
    } catch {
      // Redis unavailable — fall through to handler
    }

    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.redis.set(cacheKey, data, ttl);
        } catch {
          // Non-fatal if Redis is unavailable
        }
      }),
    );
  }
}
