import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { readFileSync } from 'fs';
import { join } from 'path';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/services/redis.service';
import { StorageService } from '../common/services/storage.service';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
jest.mock('@sentry/node', () => ({ withScope: jest.fn(), captureException: jest.fn() }));

function fixture() {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
  const ping = jest.fn().mockResolvedValue('PONG');
  const redis = { getClient: () => ({ ping }) };
  const storage = { checkReadiness: jest.fn().mockResolvedValue('ok') };
  const mongo = { readyState: 1, db: { command: jest.fn().mockResolvedValue({ ok: 1 }) } };
  const controller = new HealthController(prisma as never, redis as never, storage as never, mongo as never);
  return { controller, prisma, redis, ping, storage, mongo };
}

describe('Truthful dependency readiness', () => {
  afterEach(() => jest.useRealTimers());

  it('liveness does not pretend to probe dependencies', () => {
    const f = fixture();
    expect(f.controller.live()).toEqual({ status: 'ok', scope: 'process-only' });
    expect(f.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(f.storage.checkReadiness).not.toHaveBeenCalled();
  });

  it('reports measured dependency scopes and succeeds only when all pass', async () => {
    const f = fixture();
    await expect(f.controller.ready()).resolves.toMatchObject({ status: 'ok',
      services: { database: 'ok', redis: 'ok', mongodb: 'ok', storage: 'ok' },
      probes: { storage: 'HeadBucket (read-only; uploads not verified)' } });
    expect(f.mongo.db.command).toHaveBeenCalledWith({ ping: 1 }, { timeoutMS: 2000, signal: expect.any(AbortSignal) });
  });

  it.each(['database', 'redis', 'mongodb', 'storage'] as const)('fails closed and sanitizes a %s outage', async (dependency) => {
    const f = fixture();
    const probes = { database: f.prisma.$queryRaw, redis: f.ping, mongodb: f.mongo.db.command, storage: f.storage.checkReadiness };
    probes[dependency].mockRejectedValue(new Error('secret://credentials@example.test/private'));
    await expect(f.controller.check()).resolves.toMatchObject({ status: 'degraded', services: { [dependency]: 'error' } });
    try { await f.controller.ready(); throw new Error('Unexpected readiness'); }
    catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
      expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain('credentials');
    }
  });

  it('does not call an unconnected Mongo client or mark unconfigured storage healthy', async () => {
    const f = fixture();
    f.mongo.readyState = 0;
    f.storage.checkReadiness.mockResolvedValue('not_configured');
    await expect(f.controller.check()).resolves.toMatchObject({ status: 'degraded', services: { mongodb: 'error', storage: 'not_configured' } });
    expect(f.mongo.db.command).not.toHaveBeenCalled();
  });

  it('bounds HTTP waiting and coalesces a hung dependency until it actually settles', async () => {
    jest.useFakeTimers();
    const f = fixture();
    let release: (value: unknown) => void = () => undefined;
    f.prisma.$queryRaw.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const first = f.controller.check();
    const concurrent = f.controller.check();
    await jest.advanceTimersByTimeAsync(2000);
    expect((await first).services.database).toBe('timeout');
    expect((await concurrent).services.database).toBe('timeout');
    const retry = f.controller.check();
    await jest.advanceTimersByTimeAsync(2000);
    expect((await retry).services.database).toBe('timeout');
    expect(f.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    release([]);
    await jest.advanceTimersByTimeAsync(0);
    f.prisma.$queryRaw.mockResolvedValue([]);
    await expect(f.controller.ready()).resolves.toMatchObject({ status: 'ok' });
    expect(f.prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('uses real HTTP 503 for readiness, not a degraded HTTP 200 deployment would accept', async () => {
    const f = fixture();
    const module = await Test.createTestingModule({ controllers: [HealthController], providers: [
      { provide: PrismaService, useValue: f.prisma }, { provide: RedisService, useValue: f.redis },
      { provide: StorageService, useValue: f.storage }, { provide: getConnectionToken(), useValue: f.mongo },
    ] }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    try {
      const origin = await app.getUrl();
      f.ping.mockRejectedValue(new Error('secret detail'));
      const notReady = await fetch(`${origin}/api/v1/health/ready`);
      expect(notReady.status).toBe(503);
      expect(notReady.headers.get('cache-control')).toBe('no-store');
      expect(await notReady.json()).toMatchObject({ success: false, error: { code: 'ERR_NOT_READY', details: [{ field: 'redis', message: 'error' }] } });
      expect((await fetch(`${origin}/api/v1/health/live`)).status).toBe(200);
      f.ping.mockResolvedValue('PONG');
      const ready = await fetch(`${origin}/api/v1/health/ready`);
      expect(ready.status).toBe(200);
      expect(await ready.json()).toMatchObject({ success: true, data: { status: 'ok' } });
    } finally { await app.close(); }
  });

  it('wires deployment, smoke and container gates to readiness rather than diagnostics', () => {
    const root = join(__dirname, '../../../..');
    for (const file of ['scripts/deploy.sh', 'scripts/smoke-test.sh', 'docker/Dockerfile']) {
      const source = readFileSync(join(root, file), 'utf8');
      expect(source).toContain('/api/v1/health/ready');
      expect(source).not.toMatch(/\/api\/v1\/health(?:["'\s]|$)/);
    }
  });
});

describe('Storage readiness probe', () => {
  it('requires configured credentials and never writes an object to establish readiness', async () => {
    const service = Object.create(StorageService.prototype) as StorageService;
    const send = jest.fn().mockResolvedValue({});
    const get = jest.fn().mockReturnValue(undefined);
    Object.assign(service, { config: { get }, s3: { send }, bucket: 'isolated-fixture' });
    const signal = new AbortController().signal;
    await expect(service.checkReadiness(signal)).resolves.toBe('not_configured');
    expect(send).not.toHaveBeenCalled();
    get.mockReturnValue('test-only');
    await expect(service.checkReadiness(signal)).resolves.toBe('ok');
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'isolated-fixture' });
    expect(send.mock.calls[0][1]).toEqual({ abortSignal: signal });
    send.mockRejectedValueOnce(new Error('denied'));
    await expect(service.checkReadiness(signal)).rejects.toThrow('denied');
  });
});
