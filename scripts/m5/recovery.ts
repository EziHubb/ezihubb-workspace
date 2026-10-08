import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '../../apps/api/src/common/services/redis.service';
import { claimEconomicOperation, claimEconomicEvent, finishEconomicEvent } from '../../apps/api/src/modules/finances/economic-durability';
import { verifyAndBookEconomicCapture } from '../../apps/api/src/modules/finances/economic-capture';
import { consumeVerifiedEconomics } from '../../apps/api/src/modules/finances/economic-consumers';
import { executeExternalEffect, externalEffectHash } from '../../apps/api/src/modules/finances/economic-external-effect';
import { reserveEconomicInventory } from '../../apps/api/src/modules/products/inventory-reservation';
import { Catalog, ScenarioOrder, createCatalog, createProduct, createOrder, captureReader } from './contention-fixtures';
import { killAtBarrier, eventually, KillProof } from './recovery-process';
import { backupAndRestore } from './recovery-restore';
import { nativeReadiness } from './recovery-readiness';
import names from './recovery-contract.json';
const { ROOT, dockerContext, ownedContainers, redisAction, runIdentity } = require('./recovery-support.cjs');
const { assertRuntime, generateEnvironment, assertEnvironment, cleanChildEnvironment, assertDatabaseIdentity, DATABASES, SCENARIO_DATABASE, migrationManifest } = require('./guard.cjs');
const { sourceChecksums, assertFoundationEvidence, assertCompletedContentionReport } = require('./evidence.cjs');
const { verifyFixtureReceipt } = require('./fixtures.cjs');

export function scopedEventClient(db: PrismaClient, id: string) {
  return new Proxy(db, { get(target, key) {
    if (key === 'economicOutbox') return new Proxy(target.economicOutbox, { get(model, method) {
      if (method === 'findFirst') return (input: Prisma.EconomicOutboxFindFirstArgs) => model.findFirst({
        ...input, where: { AND: [input.where ?? {}, { id }] } });
      const value = Reflect.get(model, method); return typeof value === 'function' ? value.bind(model) : value;
    } });
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
}
async function seedIntent(db: PrismaClient, catalog: Catalog, runId: string, name: string) {
  const product = await createProduct(db, catalog, { name, quantity: 20 });
  const order = await createOrder(db, catalog, [{ ...product, quantity: 2 }], { shipping: true, wrap: true, affiliate: true });
  await db.order.update({ where: { id: order.order.id }, data: { note: `M5.4 ${runId}` } });
  await reserveEconomicInventory(db, order.context.id);
  await claimEconomicOperation(db, order.operation.id);
  return { ...order, product: product.product };
}
async function seedPaid(db: PrismaClient, catalog: Catalog, runId: string, name: string) {
  const order = await seedIntent(db, catalog, runId, name);
  const capture = await verifyAndBookEconomicCapture(db, order.operation.id, captureReader(order));
  const event = await db.economicOutbox.findUniqueOrThrow({ where: { eventKey: `capture:${capture.id}` } });
  return { ...order, event };
}
async function assertLifecycle(db: PrismaClient, order: ScenarioOrder, productId: string, eventId: string, committed: boolean) {
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.order.id } })).status, committed ? 'CONFIRMED' : 'PENDING_PAYMENT');
  assert.equal(await db.economicConsumerReceipt.count({ where: { eventId, consumer: 'lifecycle.v1' } }), committed ? 1 : 0);
  assert.equal((await db.economicInventoryReservation.findFirstOrThrow({ where: { contextId: order.context.id } })).state, committed ? 'CONSUMED' : 'HELD');
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: productId } })).quantity, 18);
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: order.order.id, status: 'CONFIRMED' } }), committed ? 1 : 0);
  assert.equal(await db.economicCapture.count({ where: { contextId: order.context.id } }), 1);
}
async function main() {
  assertRuntime();
  const [runId, foundationId, contentionId] = process.argv.slice(2);
  [runId, foundationId, contentionId].forEach(runIdentity);
  if (process.argv.length !== 5) throw new Error('M5_RECOVERY_IDENTITY');
  const env = Object.fromEntries(Object.keys(generateEnvironment()).map(key => [key, process.env[key] ?? '']));
  const supplied = env['DATABASE_URL'];
  const base = new URL(supplied); base.pathname = '/ezihubb_m5_fresh'; env['DATABASE_URL'] = base.href;
  assertEnvironment(env);
  if (supplied !== cleanChildEnvironment(env, SCENARIO_DATABASE).DATABASE_URL) throw new Error('M5_DATABASE_IDENTITY');
  // Child receives no ambient options or provider credentials.
  const context = dockerContext(env, true), containers = ownedContainers(context, env);
  const checksums = sourceChecksums(ROOT), migrations = migrationManifest(ROOT);
  const foundation = JSON.parse(readFileSync(resolve(ROOT, 'artifacts/m5', `${foundationId}.json`), 'utf8'));
  assertFoundationEvidence(foundation, checksums, migrations);
  assertCompletedContentionReport(JSON.parse(readFileSync(resolve(ROOT, 'artifacts/m5', `${contentionId}.json`), 'utf8')), checksums, migrations, foundationId);
  const pool = new Pool({ connectionString: supplied, max: 3, connectionTimeoutMillis: 5000,
    options: '-c statement_timeout=60000 -c lock_timeout=10000' });
  const db = new PrismaClient({ adapter: new PrismaPg(pool), log: [] });
  const cases: Array<{ name: string; outcome: string; assertions: string; durationMs: number } & Partial<KillProof>> = [];
  let failedCase = names[0], redisStopped = false;
  Logger.overrideLogger(false); // Scope: this standalone harness only; no secret-bearing driver logs.
  try {
    await assertDatabaseIdentity(pool, env, SCENARIO_DATABASE);
    for (const database of DATABASES) {
      const foundationPool = new Pool({ connectionString: cleanChildEnvironment(env, database).DATABASE_URL, max: 1,
        connectionTimeoutMillis: 5000, options: '-c statement_timeout=60000 -c lock_timeout=10000' });
      const foundationDb = new PrismaClient({ adapter: new PrismaPg(foundationPool), log: [] });
      try {
        await assertDatabaseIdentity(foundationPool, env, database);
        const receipt = (await foundationPool.query('SELECT payload FROM m5_guard.fixture_receipt WHERE name=$1', ['m5-foundation-fixtures-v1'])).rows[0]?.payload;
        if (!receipt || !foundation.steps.some((row: { database?: string; snapshotHash?: string }) => row.database === database && row.snapshotHash === receipt.snapshotHash)) throw new Error('M5_FOUNDATION_FIXTURES_REQUIRED');
        await verifyFixtureReceipt(foundationDb, receipt);
      } finally { await foundationDb.$disconnect(); await foundationPool.end(); }
    }
    const history = (await pool.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name')).rows;
    if (history.length !== migrations.length || history.some((row, index) => !row.finished_at || row.rolled_back_at
      || row.migration_name !== migrations[index].name || row.checksum !== migrations[index].checksum)) throw new Error('M5_MIGRATION_HISTORY');
    const owner = (await pool.query('SELECT payload FROM m5_guard.fixture_receipt WHERE name=$1', ['m5-scenarios-owner-v1'])).rows[0]?.payload;
    if (owner?.version !== 'm5-scenarios-owner-v1') throw new Error('M5_SCENARIO_OWNERSHIP');
    // Parent owns the exclusive advisory lock THROUGH independent cleanup.
    assert.equal(await db.economicOrderContext.count({ where: { provenance: { not: 'TEST' } } }), 0);
    const catalog = await createCatalog(db, runId, 'recovery');
    const childEnv = { ...cleanChildEnvironment(env, SCENARIO_DATABASE), TSX_TSCONFIG_PATH: resolve(ROOT, 'scripts/m5/recovery-runtime.tsconfig.json') };
    let replayEventId = '';
    for (const phase of ['capture-before-commit', 'capture-after-commit'] as const) {
      failedCase = names[cases.length]; const started = performance.now();
      const order = await seedIntent(db, catalog, runId, phase);
      const proof = await killAtBarrier(childEnv, runId, phase, order.operation.id);
      await eventually(async () => (await pool.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid=$1', [proof.backendPid])).rows[0].count, value => value === 0);
      const committed = phase === 'capture-after-commit';
      assert.equal(await db.economicCapture.count({ where: { contextId: order.context.id } }), committed ? 1 : 0);
      assert.equal(await db.economicJournalEntry.count({ where: { capture: { contextId: order.context.id } } }) > 0, committed);
      assert.equal(await db.economicOutbox.count({ where: { contextId: order.context.id } }), committed ? 1 : 0);
      assert.equal((await db.payment.findUniqueOrThrow({ where: { id: order.payment.id } })).status, committed ? 'PAID' : 'PENDING');
      assert.equal((await db.economicOperation.findUniqueOrThrow({ where: { id: order.operation.id } })).state, committed ? 'SUCCEEDED' : 'DISPATCHED');
      const capture = await verifyAndBookEconomicCapture(db, order.operation.id, captureReader(order));
      assert.equal((await verifyAndBookEconomicCapture(db, order.operation.id, captureReader(order))).id, capture.id);
      assert.equal(await db.economicCapture.count({ where: { contextId: order.context.id } }), 1);
      assert.equal((await db.economicJournalEntry.aggregate({ where: { captureId: capture.id }, _sum: { amountMinor: true } }))._sum.amountMinor, 0n);
      assert.equal(await db.economicBalanceLot.count({ where: { captureId: capture.id } }), order.quote.parts.length);
      assert.equal(await db.economicOutbox.count({ where: { contextId: order.context.id } }), 1);
      const event = await db.economicOutbox.findUniqueOrThrow({ where: { eventKey: `capture:${capture.id}` } });
      await consumeVerifiedEconomics(db, event, 'TEST'); await assertLifecycle(db, order, order.product.id, event.id, true);
      await db.economicOutbox.update({ where: { id: event.id }, data: { availableAt: new Date('9999-01-01T00:00:00Z') } });
      cases.push({ name: failedCase, outcome: 'PASS', assertions: 'NATIVE_EFFECTS_AND_RECOVERY', durationMs: performance.now() - started, ...proof });
    }
    for (const phase of ['before-commit', 'after-commit', 'lease-claimed'] as const) {
      failedCase = names[cases.length]; const started = performance.now();
      const order = await seedPaid(db, catalog, runId, phase);
      const proof = await killAtBarrier(childEnv, runId, phase, order.event.id);
      // Wait for actual disconnect/rollback, not a fabricated timestamp.
      await eventually(async () => (await pool.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid=$1', [proof.backendPid])).rows[0].count,
        value => value === 0);
      if (phase !== 'lease-claimed') {
        await assertLifecycle(db, order, order.product.id, order.event.id, phase === 'after-commit');
        assert.equal(await consumeVerifiedEconomics(db, order.event, 'TEST'), phase === 'before-commit');
        assert.equal(await consumeVerifiedEconomics(db, order.event, 'TEST'), false);
        await assertLifecycle(db, order, order.product.id, order.event.id, true);
      } else {
        const leased = await db.economicOutbox.findUniqueOrThrow({ where: { id: order.event.id } });
        assert.equal(leased.state, 'CLAIMED'); assert.equal(leased.attempts, 1); assert(leased.leaseToken && leased.leaseUntil);
        const scoped = scopedEventClient(db, leased.id);
        assert.equal(await claimEconomicEvent(scoped, new Date(), 'TEST'), null);
        const recovered = await eventually(() => claimEconomicEvent(scoped, new Date(), 'TEST'), value => value !== null, 40_000);
        assert(recovered?.leaseToken); assert.equal(recovered.attempts, 2);
        assert.notEqual(recovered.leaseToken, leased.leaseToken);
        assert.equal((await finishEconomicEvent(db, leased.id, leased.leaseToken, true)).count, 0);
        await consumeVerifiedEconomics(db, recovered, 'TEST');
        assert.equal((await finishEconomicEvent(db, leased.id, recovered.leaseToken, true)).count, 1);
        await assertLifecycle(db, order, order.product.id, order.event.id, true);
      }
      // Preserve successful direct-consumption events without polluting another drill's publisher.
      if (phase !== 'lease-claimed') await db.economicOutbox.updateMany({ where: { id: order.event.id, state: 'PENDING' }, data: { availableAt: new Date('9999-01-01T00:00:00Z') } });
      replayEventId = order.event.id;
      cases.push({ name: failedCase, outcome: 'PASS', assertions: 'NATIVE_EFFECTS_AND_RECOVERY', durationMs: performance.now() - started, ...proof });
    }
    failedCase = names[cases.length]; let started = performance.now();
    const externalOrder = await seedPaid(db, catalog, runId, 'external');
    await consumeVerifiedEconomics(db, externalOrder.event, 'TEST');
    const shop = await db.storeOrder.findFirstOrThrow({ where: { orderId: externalOrder.order.id } });
    const connection = await db.storeFulfillmentConnection.create({ data: { storeId: shop.storeId, provider: 'PRINTIFY',
      status: 'ACTIVE', externalShopId: 'm54_local_synthetic', encryptedApiKey: 'm5-disabled-synthetic-not-a-provider-secret' } });
    const payload = { contextId: externalOrder.context.id, synthetic: true };
    const effect = await db.economicExternalEffect.create({ data: { contextId: externalOrder.context.id,
      kind: 'POD_PRINTIFY', storeOrderId: shop.id, connectionId: connection.id,
      providerAccount: 'm54_local_synthetic', effectKey: externalEffectHash({ runId }),
      payload, payloadHash: externalEffectHash(payload), requestedBy: catalog.admin.id, reason: `M5.4 ${runId}` } });
    const proof = await killAtBarrier(childEnv, runId, 'external-created', effect.id);
    const adapter = { kind: effect.kind, providerAccount: effect.providerAccount, provenance: 'TEST' as const,
      create: async (): Promise<string> => { throw new Error('M5_RECOVERY_DUPLICATE_CREATE'); },
      verify: async (_effect: unknown, reference: string) => {
        const recorded = (await pool.query('SELECT payload FROM m5_guard.fixture_receipt WHERE name=$1', [`m5-recovery-external:${runId}`])).rows[0]?.payload;
        assert.equal(recorded?.reference, reference); assert.equal(recorded.payloadHash, effect.payloadHash);
        return externalEffectHash(recorded);
      } };
    assert.equal((await db.economicExternalEffect.findUniqueOrThrow({ where: { id: effect.id } })).state, 'DISPATCHED');
    await assert.rejects(executeExternalEffect(db, effect.id, 'TEST', adapter, async () => undefined), /never redispatch/);
    const recovered = await executeExternalEffect(db, effect.id, 'TEST', adapter, async () => undefined, `m54_${runId}`);
    assert.equal(recovered.state, 'SUCCEEDED');
    assert.deepEqual(await executeExternalEffect(db, effect.id, 'TEST', adapter, async () => undefined), recovered);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM m5_guard.fixture_receipt WHERE name=$1', [`m5-recovery-external:${runId}`])).rows[0].count, 1);
    await db.economicOutbox.update({ where: { id: externalOrder.event.id }, data: { availableAt: new Date('9999-01-01T00:00:00Z') } });
    cases.push({ name: failedCase, outcome: 'PASS', assertions: 'NATIVE_EFFECTS_AND_RECOVERY', durationMs: performance.now() - started, ...proof });

    failedCase = names[cases.length]; started = performance.now();
    const redis = new RedisService(new ConfigService({ redis: { url: env['REDIS_URL'] } }));
    let readiness: Awaited<ReturnType<typeof nativeReadiness>> | undefined;
    try {
      await redis.onModuleInit();
      readiness = await nativeReadiness(env, db, redis, pool, runId);
      assert.equal(await readiness.readyStatus(), 200);
      const key = `m54:${runId}:security`, queueKey = `m54:${runId}:queue`;
      assert.equal(await redis.incrementSecurityCounter(key, 600), 1);
      redisStopped = true; redisAction(context, env, containers.redis, 'stop');
      await eventually(async () => redis.isAvailable(), value => value === false);
      await assert.rejects(redis.getSecurityCounter(key), error => error instanceof ServiceUnavailableException && error.getStatus() === 503);
      assert.equal(await redis.get(`m54:${runId}:cache`), null);
      assert.equal(await readiness.readyStatus(), 503);
      assert.equal(await readiness.alertStatus(), 202);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM m5_guard.fixture_receipt WHERE name=$1', [`m5-recovery-independent-alert:${runId}`])).rows[0].count, 1);
      // Recovery witness is committed to PostgreSQL, not the failed Redis.
      await pool.query('INSERT INTO m5_guard.fixture_receipt(name,payload) VALUES($1,$2::jsonb)',
        [`m5-recovery-redis-outage:${runId}`, JSON.stringify({ securityBlocked: true, cacheFallback: true })]);
      const order = await seedPaid(db, catalog, runId, 'redis-outage');
      const scoped = scopedEventClient(db, order.event.id);
      const leased = await claimEconomicEvent(scoped, new Date(), 'TEST'); assert(leased?.leaseToken);
      await assert.rejects(redis.getClient().lpush(queueKey, leased.id));
      assert.equal((await finishEconomicEvent(db, leased.id, leased.leaseToken, false)).count, 1);
      assert.equal((await db.economicOutbox.findUniqueOrThrow({ where: { id: leased.id } })).state, 'PENDING');
      redisAction(context, env, containers.redis, 'start'); redisStopped = false;
      await eventually(async () => redis.isAvailable(), value => value === true, 30_000);
      assert.equal(await readiness.readyStatus(), 200);
      assert.equal(await redis.getSecurityCounter(key), 1);
      const retry = await eventually(() => claimEconomicEvent(scoped, new Date(), 'TEST'), value => value !== null); assert(retry?.leaseToken);
      await redis.getClient().lpush(queueKey, retry.id, retry.id);
      assert.equal(await redis.getClient().rpop(queueKey), retry.id);
      assert.equal(await consumeVerifiedEconomics(db, retry, 'TEST'), true);
      assert.equal(await redis.getClient().rpop(queueKey), retry.id);
      assert.equal(await consumeVerifiedEconomics(db, retry, 'TEST'), false);
      assert.equal((await finishEconomicEvent(db, retry.id, retry.leaseToken, true)).count, 1);
      await assertLifecycle(db, order, order.product.id, retry.id, true);
      replayEventId = retry.id;
    } finally {
      if (redisStopped) { redisAction(context, env, containers.redis, 'start'); redisStopped = false; }
      await readiness?.close();
      await redis.onModuleDestroy();
    }
    cases.push({ name: failedCase, outcome: 'PASS', assertions: 'NATIVE_EFFECTS_AND_RECOVERY', durationMs: performance.now() - started });
    failedCase = names[cases.length]; started = performance.now();
    const restore = await backupAndRestore({ env, context, postgresId: containers.postgres, runId, sourcePool: pool, sourceDb: db, catalog, replayEventId });
    cases.push({ name: failedCase, outcome: 'PASS', assertions: 'NATIVE_EFFECTS_AND_RECOVERY', durationMs: performance.now() - started });
    await pool.query('INSERT INTO m5_guard.fixture_receipt(name,payload) VALUES($1,$2::jsonb)',
      [`m5-recovery-run:${runId}`, JSON.stringify({ outcome: 'PASS', caseCount: cases.length, restoreDatabase: restore.database })]);
    console.log(JSON.stringify({ version: 'm5.4-cases-v1', runId, foundationId, contentionId, outcome: 'PASS',
      scope: 'LOCAL_SYNTHETIC_RECOVERY_ONLY', fullStack: false, providerOperations: false, cases, restore }));
  } catch {
    console.log(JSON.stringify({ version: 'm5.4-cases-v1', outcome: 'FAIL', failedCase }));
  } finally {
    if (redisStopped) redisAction(context, env, containers.redis, 'start');
    await db.$disconnect(); await pool.end();
  }
}
if (require.main === module) main().catch(() => { console.log(JSON.stringify({ outcome: 'BLOCKED', code: 'M5_RECOVERY_FAILED' })); process.exitCode = 1; });
