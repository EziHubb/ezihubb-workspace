import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('redis.url') ?? 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    this.client.on('error', (err: Error) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
    this.client.on('connect', () => this.logger.log('Redis connected'));

    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const val = await this.client.get(key);
    if (val === null) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const val = await this.client.incr(key);
    if (ttlSeconds && val === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return val;
  }

  /** Delete all keys matching a glob pattern (e.g. "products:list:*") */
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  /** Expose raw client for advanced use (pipelines, transactions) */
  getClient(): Redis {
    return this.client;
  }
}

// ── Cache key constants ────────────────────────────────────────────────────────
export const CacheKeys = {
  productsList:     (hash: string) => `products:list:${hash}`,
  product:          (slug: string) => `product:${slug}`,
  categoriesTree:   () => 'categories:tree',
  reviewsSummary:   (productId: string) => `reviews:summary:${productId}`,
  autocomplete:     (q: string) => `search:autocomplete:${q}`,
  cartSessionId:    (sessionId: string) => `cart:session:${sessionId}`,
  shippingMethods:  (country: string) => `shipping:methods:${country}`,
} as const;

export const CacheTtl = {
  short:       60,    // 1 min  — product list, search
  medium:      300,   // 5 min  — product detail, review summary
  long:        600,   // 10 min — category tree, shipping methods
  extraLong:  3600,   // 1 hr   — rarely-changing config
} as const;
