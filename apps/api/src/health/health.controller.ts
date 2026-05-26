import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    storage: 'ok' | 'error';
  };
  version: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allOk = dbStatus === 'ok' && redisStatus === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        storage: 'ok',
      },
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }

  private async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<'ok' | 'error'> {
    try {
      const pong = await this.redis.getClient().ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
