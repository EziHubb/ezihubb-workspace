import { createServer, request, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { HealthController } from '../../apps/api/src/health/health.controller';
import { RedisService } from '../../apps/api/src/common/services/redis.service';
import { StorageService } from '../../apps/api/src/common/services/storage.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
const { assertEnvironment } = require('./guard.cjs');

async function listen(server: Server) {
  await new Promise<void>((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  return (server.address() as AddressInfo).port;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>(done => server.close(() => done()));
}
export async function localRequest(port: number, path: '/health/ready' | '/alerts', method: 'GET' | 'POST' = 'GET', body?: string) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('M5_RECOVERY_LOCAL_HTTP_IDENTITY');
  return new Promise<number>((yes, no) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, agent: false,
      headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {} }, res => {
      res.resume(); res.once('end', () => yes(res.statusCode ?? 0));
    });
    req.setTimeout(5000, () => req.destroy()); req.once('error', () => no(new Error('M5_RECOVERY_LOCAL_HTTP_FAILED')));
    req.end(body);
  });
}
/** HTTP adapter/proxy around the production readiness METHOD. This is deliberately
 * not AppModule, production reverse proxy/TLS, an authenticated API or an alert provider. */
export async function readinessGateway(controller: Pick<HealthController, 'ready'>,
  witness: (payload: { code: string; scope: string }) => Promise<void>) {
  const upstream = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/health/ready') { res.writeHead(404); res.end(); return; }
    void controller.ready().then(() => { res.writeHead(200, { 'cache-control': 'no-store' }); res.end(); })
      .catch(error => { res.writeHead(error instanceof HttpException ? error.getStatus() : 500, { 'cache-control': 'no-store' }); res.end(); });
  });
  const proxy = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/health/ready') { res.writeHead(404); res.end(); return; }
    const forwarded = request({ hostname: '127.0.0.1', port: upstreamPort, path: '/health/ready', method: 'GET', agent: false }, reply => {
      res.writeHead(reply.statusCode ?? 503, { 'cache-control': 'no-store' }); reply.pipe(res);
    });
    forwarded.setTimeout(4000, () => forwarded.destroy());
    forwarded.once('error', () => { if (!res.headersSent) res.writeHead(503); res.end(); }); forwarded.end();
  });
  const sink = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/alerts') { res.writeHead(404); res.end(); return; }
    req.setTimeout(5000, () => req.destroy());
    let body = '', size = 0;
    req.on('data', data => { size += data.length; if (size > 1024) req.destroy(); else body += data; });
    req.on('end', () => {
      let payload: { code: string; scope: string };
      try { payload = JSON.parse(body); } catch { res.writeHead(400); res.end(); return; }
      if (JSON.stringify(payload) !== JSON.stringify({ code: 'ERR_NOT_READY', scope: 'M5_LOCAL_SYNTHETIC' })) { res.writeHead(400); res.end(); return; }
      void witness(payload).then(() => { res.writeHead(202); res.end(); }).catch(() => { res.writeHead(503); res.end(); });
    });
  });
  let upstreamPort = 0;
  try {
    upstreamPort = await listen(upstream); const proxyPort = await listen(proxy); const sinkPort = await listen(sink);
    return { readyStatus: () => localRequest(proxyPort, '/health/ready'),
      alertStatus: () => localRequest(sinkPort, '/alerts', 'POST', JSON.stringify({ code: 'ERR_NOT_READY', scope: 'M5_LOCAL_SYNTHETIC' })),
      close: async () => { await Promise.all([close(proxy), close(upstream), close(sink)]); } };
  } catch (error) { await Promise.all([close(proxy), close(upstream), close(sink)]); throw error; }
}
export async function nativeReadiness(env: Record<string, string>, db: PrismaClient, redis: RedisService, pool: Pool, runId: string) {
  assertEnvironment(env);
  const mongo = mongoose.createConnection();
  const storage = new StorageService(new ConfigService({ storage: { endpoint: env['AWS_S3_ENDPOINT'], region: env['AWS_S3_REGION'],
    accessKeyId: 'test', secretAccessKey: 'test', bucket: env['AWS_S3_BUCKET'] } }));
  const dispose = async () => {
    await mongo.close();
    // Dispose this owned standalone instance's SDK sockets (production API has no destroy hook).
    (storage as unknown as { s3: { destroy(): void } }).s3.destroy();
  };
  try {
    await mongo.openUri(env['MONGODB_URI'], { authSource: 'admin', serverSelectionTimeoutMS: 5000 });
    const controller = new HealthController(db as PrismaService, redis, storage, mongo);
    const gateway = await readinessGateway(controller, async payload => {
      await pool.query('INSERT INTO m5_guard.fixture_receipt(name,payload) VALUES($1,$2::jsonb)', [`m5-recovery-independent-alert:${runId}`, JSON.stringify(payload)]);
    });
    return { ...gateway, close: async () => { await gateway.close(); await dispose(); } };
  } catch (error) { await dispose(); throw error; }
}
