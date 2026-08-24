import { Logger, type INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.io wired through Redis pub/sub.
 *
 * Fitted from the first deploy even though only one API instance runs today.
 * Without it a second instance delivers a message only to the clients that
 * happen to be connected to the same process — which does not fail loudly, it
 * fails as "chat works, except sometimes it doesn't", and it appears the day
 * someone scales up rather than the day the code changed.
 *
 * Two dedicated connections: node-redis and ioredis alike put a client into
 * subscriber mode when it subscribes, after which it will not answer normal
 * commands. Sharing the app's client would break every cache read.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  constructor(app: INestApplicationContext) {
    super(app);
  }

  /**
   * Returns false when Redis is unreachable, so the caller can fall back to
   * the in-memory adapter rather than refusing to boot. One instance with an
   * in-memory adapter is exactly as correct as one instance with Redis; the
   * degradation only matters once there are two, and an API that will not
   * start is worse than one that cannot scale for an hour.
   */
  async connect(url: string): Promise<boolean> {
    try {
      const pub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
      const sub = pub.duplicate();
      await Promise.all([pub.connect(), sub.connect()]);
      this.clients = [pub, sub];
      this.adapterConstructor = createAdapter(pub, sub);
      return true;
    } catch (e) {
      this.logger.warn(
        `Redis socket adapter unavailable (${(e as Error).message}) — running single-instance`,
      );
      return false;
    }
  }

  /**
   * Takes the server and delegates: the base close() is what actually shuts
   * the socket server down. An override that only quit the Redis clients would
   * leave every connection open and the process refusing to exit — and it
   * would look like a clean override, because dropping a parameter is legal.
   */
  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all(this.clients.map((c) => c.quit().catch(() => undefined)));
    this.clients = [];
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options) as {
      adapter: (a: unknown) => void;
    };
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
