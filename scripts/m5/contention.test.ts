import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { race, expectSuccesses } from './contention-support';
import { createCatalog, createProduct, createOrder, captureReader } from './contention-fixtures';
import { SCENARIOS } from './contention-cases';
const { assertFoundationEvidence, assertContentionEvidence, sourceChecksums } = require('./evidence.cjs');
const { generateEnvironment, cleanChildEnvironment, SCENARIO_DATABASE } = require('./guard.cjs');

test('23 fixed native cases are registered, not silently skipped or renamed', () => {
  assert.equal(SCENARIOS.length, 23); assert.equal(new Set(SCENARIOS).size, 23);
  const source = readFileSync(resolve(__dirname, 'contention-cases.ts'), 'utf8');
  for (const name of SCENARIOS) assert(source.includes(`name === '${name}'`), name);
  assert(!/\.skip\(|DROP\s|TRUNCATE\s|deleteMany\(/.test(source));
});
test('third database derives only from the strictly validated local manifest', () => {
  const env = generateEnvironment(), child = cleanChildEnvironment(env, SCENARIO_DATABASE);
  const url = new URL(child.DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, '/ezihubb_m5_scenarios');
  assert.equal(url.username, 'ezihubb_m5'); assert.equal(url.search, '');
  assert.equal(env.DATABASE_URL.endsWith('/ezihubb_m5_fresh'), true);
  assert.equal(child.ECONOMIC_V1_ENABLED, 'false'); assert.equal(child.STRIPE_SECRET_KEY, '');
});
function foundation() {
  return { version: 'm5.1-v1', action: 'verify', outcome: 'PASS', foundationVerified: true,
    productionActivated: false, providerOperations: false, scope: 'LOCAL_SYNTHETIC_FOUNDATION_ONLY', runId: 'a'.repeat(24),
    sourceChecksums: { 'candidate.ts': 'a'.repeat(64) }, migrations: [{ name: 'candidate', checksum: 'b'.repeat(64) }],
    steps: ['native-postgresql-fresh-chain', 'native-postgresql-upgrade-chain', 'local-redis-mongo-storage-mail-connectivity'].map(name => ({ name, outcome: 'PASS' })) };
}
test('foundation gate rejects old, partial, provider-active and wrong-candidate evidence', () => {
  const report = foundation();
  assert.equal(assertFoundationEvidence(report, report.sourceChecksums, report.migrations), report.runId);
  for (const changed of [{ ...report, foundationVerified: false }, { ...report, action: 'up' },
    { ...report, outcome: 'BLOCKED' }, { ...report, providerOperations: true }, { ...report, steps: report.steps.slice(1) },
    { ...report, sourceChecksums: {} }, { ...report, migrations: [] }]) {
    assert.throws(() => assertFoundationEvidence(changed, report.sourceChecksums, report.migrations), /M5_FOUNDATION_EVIDENCE_REQUIRED/);
  }
});
function contention() {
  return { version: 'm5.2-cases-v1', outcome: 'PASS', runId: 'b'.repeat(24), foundationId: 'a'.repeat(24),
    database: SCENARIO_DATABASE, providerEvidence: 'SYNTHETIC_TEST_ONLY', fullStack: false,
    cases: SCENARIOS.map(name => ({ name, outcome: 'PASS', assertions: 'EXACT_DB_STATE', backendPids: [101, 102] })) };
}
test('contention acceptance requires all cases and independent native-session evidence', () => {
  const report = contention(); assert.equal(assertContentionEvidence(report, report.runId, report.foundationId).length, 23);
  for (const changed of [{ ...report, cases: report.cases.slice(1) }, { ...report, fullStack: true },
    { ...report, providerEvidence: 'LIVE' }, { ...report, outcome: 'FAIL' }, { ...report, database: 'production' },
    { ...report, cases: report.cases.map(row => ({ ...row, backendPids: [101, 101] })) },
    { ...report, cases: report.cases.map(row => ({ ...row, backendPids: [-1, 102] })) }]) {
    assert.throws(() => assertContentionEvidence(changed, report.runId, report.foundationId), /M5_CONTENTION_INCOMPLETE/);
  }
});
test('source fingerprints include business code, migrations and native runner, not private env', () => {
  const source = sourceChecksums(resolve(__dirname, '../..'));
  for (const file of ['scripts/m5/contention-cases.ts', 'scripts/m5/contention.ts', 'apps/api/src/modules/finances/economic-refund.ts',
    'apps/api/src/modules/products/inventory-reservation.ts', 'prisma/migrations/20261008170000_economic_shipping_override/migration.sql']) {
    assert.match(source[file], /^[a-f0-9]{64}$/);
  }
  assert(!Object.keys(source).some(file => file.includes('.env') || file.includes('.codex')));
});
function modeledClient(pid: number, events: string[]): PrismaClient {
  return { $transaction: async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
    events.push(`open:${pid}`);
    return work({ $queryRaw: async () => [{ pid }] } as unknown as Prisma.TransactionClient);
  } } as unknown as PrismaClient;
}
test('rendezvous coordinator waits for both transactions, not a serial mock scheduler (unit model only)', async () => {
  const events: string[] = [];
  const result = await race([modeledClient(11, events), modeledClient(12, events)], async (db, index) => db.$transaction(async () => {
    assert.equal(events.filter(event => event.startsWith('open:')).length, 2); events.push(`effect:${index}`); return index;
  }));
  expectSuccesses(result.results, 2); assert.deepEqual(result.backendPids, [11, 12]);
});
test('one-backend fake concurrency is rejected by the coordinator', async () => {
  await assert.rejects(race([modeledClient(11, []), modeledClient(11, [])], db => db.$transaction(async () => true)), /independent native PG sessions/);
});
test('unexpected driver/logic failures never count as expected business race losers', () => {
  expectSuccesses([{ status: 'fulfilled', value: 1 }, { status: 'rejected', reason: { code: 'P2034' } }], 1);
  expectSuccesses([{ status: 'rejected', reason: new Error('Insufficient inventory') }], 0, /Insufficient inventory/);
  assert.throws(() => expectSuccesses([{ status: 'rejected', reason: new Error('ECONNREFUSED') }], 0, /Insufficient inventory/));
});

// Fixture shape validation only: not SQL, not native Prisma, not concurrency.
function fixtureModel() {
  type Row = Record<string, unknown>;
  const rows: Record<string, Row[]> = {};
  let sequence = 0;
  const tx: Record<string, unknown> = { $queryRaw: async () => [], $transaction: async (work: (db: unknown) => Promise<unknown>) => work(tx) };
  for (const model of Prisma.dmmf.datamodel.models) {
    const key = model.name[0].toLowerCase() + model.name.slice(1); rows[key] = [];
    tx[key] = {
      create: async ({ data }: { data: Row }) => {
        for (const field of model.fields.filter(field => field.kind !== 'object' && field.isRequired && !field.hasDefaultValue && !field.isUpdatedAt)) {
          assert.notEqual(data[field.name], undefined, `${model.name}.${field.name} required`);
        }
        const row: Row = { id: (++sequence).toString().padStart(12, '0'), ...data };
        for (const field of model.fields.filter(field => field.kind !== 'object')) {
          if (row[field.name] !== undefined) continue;
          if (field.type === 'DateTime') row[field.name] = new Date();
          else if (typeof field.default === 'string' || typeof field.default === 'boolean' || typeof field.default === 'number') row[field.name] = field.default;
          else if (!field.isRequired) row[field.name] = null;
        }
        for (const field of model.fields.filter(field => field.type === 'Decimal')) if (row[field.name] != null) row[field.name] = new Prisma.Decimal(String(row[field.name]));
        rows[key].push(row); return row;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(rows[key].find(row => row.id === where.id) ?? {}, data),
      findUnique: async () => null, count: async () => 0,
      createMany: async ({ data }: { data: Row[] }) => { for (const row of data) await (tx[key] as { create: (input: { data: Row }) => Promise<Row> }).create({ data: row }); return { count: data.length }; },
      findUniqueOrThrow: async ({ where }: { where: Row }) => {
        const row = rows[key].find(row => row.id === where.id || (key === 'economicOperation' && row.idempotencyKey === (where.provider_providerAccount_provenance_kind_idempotencyKey as Row)?.idempotencyKey));
        assert(row);
        if (key === 'order') return { ...row, items: rows.orderItem.filter(item => item.orderId === row.id),
          storeOrders: rows.storeOrder.filter(shop => shop.orderId === row.id), payment: rows.payment.find(payment => payment.orderId === row.id) ?? null };
        return row;
      },
    };
  }
  return { db: tx as unknown as PrismaClient, rows };
}
test('synthetic multi-shop/guest fixtures satisfy generated Prisma required fields and exact quote totals', async () => {
  const { db, rows } = fixtureModel();
  const catalog = await createCatalog(db, 'a'.repeat(24), 'model-validation');
  const a = await createProduct(db, catalog, { name: 'variant', variant: true });
  const b = await createProduct(db, catalog, { name: 'digital', digital: true, unlimited: true, store: 1 });
  const order = await createOrder(db, catalog, [{ ...a, quantity: 2 }, { ...b, quantity: 3 }], { shipping: true, wrap: true, affiliate: true, guest: true });
  assert.equal(order.quote.customerTotalMinor, '6600'); assert.equal(order.quote.sellerNetMinor, '6398');
  assert.equal(order.quote.affiliate?.commissionMinor, '50'); assert.equal(order.quote.stores.length, 2);
  assert.equal(order.order.userId, null); assert.match(order.order.guestEmail ?? '', /@ezihubb\.test$/);
  assert(rows.user.every(row => row.passwordHash === null)); assert.equal(rows.economicCapture.length, 0);
  assert.equal((await captureReader(order).read()).livemode, false);
});
test('workflow runs foundation before contention and never enables production gates', () => {
  const source = readFileSync(resolve(__dirname, '../../.github/workflows/m5-foundation.yml'), 'utf8');
  assert(source.indexOf('api:m5-verify ') < source.indexOf('api:m5-contention '));
  assert(source.includes('api:m5-contention-test ')); assert(!source.includes('secrets.'));
});
