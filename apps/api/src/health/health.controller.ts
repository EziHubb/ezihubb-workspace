import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
import { StorageService } from '../common/services/storage.service';

type ProbeStatus = 'ok' | 'error' | 'timeout' | 'not_configured';
type Dependency = 'database' | 'redis' | 'mongodb' | 'storage';
const PROBE_TIMEOUT_MS = 2000;

interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: Record<Dependency, ProbeStatus>;
  probes: Record<Dependency, string>;
  version: string;
}

@Controller('health')
export class HealthController {
  // Keep timed-out operations until they settle, rather than spawning a new
  // hung database query on every health request.
  private readonly pending = new Map<Dependency, { result: Promise<ProbeStatus>; abort: AbortController }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  @Get('live')
  @Header('Cache-Control', 'no-store')
  live() { return { status: 'ok', scope: 'process-only' }; }

  /** Diagnostic compatibility endpoint; deployment must use /ready. */
  @Get()
  @Header('Cache-Control', 'no-store')
  async check(): Promise<HealthStatus> {
    const [database, redis, mongodb, storage] = await Promise.all([
      this.probe('database', async () => { await this.prisma.$queryRaw`SELECT 1`; return 'ok'; }),
      this.probe('redis', async () => await this.redis.getClient().ping() === 'PONG' ? 'ok' : 'error'),
      this.probe('mongodb', async (signal) => {
        if (this.mongo.readyState !== 1 || !this.mongo.db) return 'error';
        const response = await this.mongo.db.command({ ping: 1 }, { timeoutMS: PROBE_TIMEOUT_MS, signal });
        return response.ok === 1 ? 'ok' : 'error';
      }),
      this.probe('storage', (signal) => this.storage.checkReadiness(signal)),
    ]);
    const services = { database, redis, mongodb, storage };
    return {
      status: Object.values(services).every((status) => status === 'ok') ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      probes: { database: 'SELECT 1', redis: 'PING', mongodb: 'ping', storage: 'HeadBucket (read-only; uploads not verified)' },
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready(): Promise<HealthStatus> {
    const report = await this.check();
    if (report.status !== 'ok') throw new ServiceUnavailableException({
      code: 'ERR_NOT_READY', message: 'Required dependencies are unavailable.',
      details: Object.entries(report.services).filter(([, status]) => status !== 'ok')
        .map(([field, message]) => ({ field, message })),
    });
    return report;
  }

  private async probe(key: Dependency, run: (signal: AbortSignal) => Promise<ProbeStatus>): Promise<ProbeStatus> {
    let operation = this.pending.get(key);
    if (!operation) {
      const abort = new AbortController();
      const result = Promise.resolve().then(() => run(abort.signal)).catch(() => 'error' as const);
      operation = { result, abort };
      this.pending.set(key, operation);
      void result.then(() => { this.pending.delete(key); });
    }
    const current = operation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        current.result,
        new Promise<ProbeStatus>((resolve) => {
          timer = setTimeout(() => { resolve('timeout'); current.abort.abort(); }, PROBE_TIMEOUT_MS);
        }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }
}
