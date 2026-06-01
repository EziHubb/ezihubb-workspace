import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private available = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('redis.url') ?? 'redis://localhost:6379';

    this.client = new Redis(url, {
      maxRetriesPerRequest:          0,   // fail commands immediately if not connected
      enableOfflineQueue:            false, // don't queue commands while disconnected
      lazyConnect:                   true,
      connectTimeout:                500,
      retryStrategy:                 () => null, // never reconnect
      autoResendUnfulfilledCommands: false,
    });

    this.client.on('error',   (err: Error) => this.logger.warn(`Redis: ${err.message}`));
    this.client.on('connect', ()           => { this.available = true; this.logger.log('Redis connected'); });
    this.client.on('close',   ()           => { this.available = false; });

    try {
      await this.client.connect();
      this.available = true;
    } catch (err) {
      this.logger.warn(`Redis unavailable (${(err as Error).message}) — cache disabled`);
      this.available = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.quit().catch(() => {});
  }

  // ── Safe wrappers — return fallback values when Redis is unavailable ──────────

  async get<T>(key: string): Promise<T | null> {
    if (!this.available) return null;
    try {
      const val = await this.client.get(key);
      if (val === null) return null;
      return JSON.parse(val) as T;
    } catch { return null; }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.available) return;
    try {
      const s = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.setex(key, ttlSeconds, s);
      } else {
        await this.client.set(key, s);
      }
    } catch { /* no-op */ }
  }

  async del(key: string): Promise<void> {
    if (!this.available) return;
    try { await this.client.del(key); } catch { /* no-op */ }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.available) return false;
    try { return (await this.client.exists(key)) > 0; } catch { return false; }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.available) return 0;
    try {
      const val = await this.client.incr(key);
      if (ttlSeconds && val === 1) await this.client.expire(key, ttlSeconds);
      return val;
    } catch { return 0; }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.available) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) await this.client.del(...keys);
    } catch { /* no-op */ }
  }

  /** Raw client for advanced use — callers must handle errors when unavailable */
  getClient(): Redis {
    return this.client;
  }

  isAvailable(): boolean {
    return this.available;
  }
}

// ── Cache key constants ────────────────────────────────────────────────────────
export const CacheKeys = {
  productsList:    (hash: string)      => `products:list:${hash}`,
  product:         (slug: string)      => `product:${slug}`,
  categoriesTree:  ()                  => 'categories:tree',
  reviewsSummary:  (productId: string) => `reviews:summary:${productId}`,
  autocomplete:    (q: string)         => `search:autocomplete:${q}`,
  cartSessionId:   (sessionId: string) => `cart:session:${sessionId}`,
  shippingMethods: (country: string)   => `shipping:methods:${country}`,
} as const;

export const CacheTtl = {
  short:      60,    // 1 min
  medium:     300,   // 5 min
  long:       600,   // 10 min
  extraLong: 3600,   // 1 hr
} as const;
