const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Prisma } = require('@prisma/client');
const { generateEnvironment, BEFORE_M4 } = require('./guard.cjs');
const { seedFixtures, assertFixtureReplayUnchanged } = require('./fixtures.cjs');

test('fixture replay accepts JSONB object-key reordering but rejects every changed value', () => {
  const before = { version: 'fixture-v1', ids: { users: ['buyer', 'seller'], stores: ['shop'] },
    snapshotHash: 'original', seededMigrationHead: BEFORE_M4, collectedMoney: false };
  const replay = { collectedMoney: false, seededMigrationHead: BEFORE_M4, snapshotHash: 'original',
    ids: { stores: ['shop'], users: ['buyer', 'seller'] }, version: 'fixture-v1' };
  assert.notEqual(JSON.stringify(before), JSON.stringify(replay));
  assertFixtureReplayUnchanged(before, replay);
  for (const change of [
    row => { row.ids.users.reverse(); }, row => { row.ids.stores[0] = 'other'; },
    row => { row.snapshotHash = 'changed'; }, row => { row.seededMigrationHead = 'changed'; },
    row => { row.collectedMoney = true; }, row => { row.collectedMoney = 'false'; },
    row => { delete row.version; }, row => { row.extra = true; },
  ]) {
    const changed = structuredClone(replay); change(changed);
    assert.throws(() => assertFixtureReplayUnchanged(before, changed), /M5_FIXTURE_CHANGED/);
  }
});

// Unit-shaped Prisma model validation/replay checks. NOT real Prisma/DB evidence.
function fixtureDatabase() {
  let sequence = 0, receipt;
  const rows = {}, counters = { writes: 0 };
  const tx = {
    $executeRawUnsafe: async (sql, _name, payload) => {
      if (sql.startsWith('INSERT')) {
        receipt = JSON.parse(payload);
        receipt.ids = Object.fromEntries(Object.entries(receipt.ids).reverse());
        counters.writes++;
      }
    },
    $queryRawUnsafe: async sql => sql.includes('_prisma_migrations') ? [{ migration_name: BEFORE_M4 }] : receipt ? [{ payload: receipt }] : [],
  };
  for (const model of Prisma.dmmf.datamodel.models) {
    const name = model.name[0].toLowerCase() + model.name.slice(1);
    rows[name] = [];
    tx[name] = {
      count: async () => rows[name].length,
      create: async ({ data }) => {
        counters.writes++;
        for (const field of model.fields.filter(field => field.kind !== 'object' && field.isRequired && !field.hasDefaultValue && !field.isUpdatedAt && !field.isList)) {
          assert.notEqual(data[field.name], undefined, `${model.name}.${field.name} required`);
        }
        for (const key of Object.keys(data)) assert(model.fields.some(field => field.name === key), `${model.name}.${key} unknown`);
        const row = { id: String(++sequence).padStart(12, '0'), ...data };
        rows[name].push(row); return row;
      },
      update: async ({ where, data }) => {
        counters.writes++;
        const row = rows[name].find(item => item.id === where.id); assert(row); Object.assign(row, data); return row;
      },
      findMany: async ({ where = {}, select }) => rows[name].filter(row => Object.entries(where).every(([key, expected]) =>
        expected?.in ? expected.in.includes(row[key]) : row[key] === expected))
        .map(row => Object.fromEntries(Object.keys(select).map(key => [key, row[key] ?? null])))
        .sort((a, b) => String(a.id ?? a.productId).localeCompare(String(b.id ?? b.productId))),
    };
  }
  return { db: { $transaction: async callback => callback(tx) }, rows, counters };
}
function identityPool(env) {
  return { query: async sql => ({ rows: sql.includes('pg_roles')
    ? [{ database: 'ezihubb_m5_upgrade', role: 'ezihubb_m5', privileged: false }] : [{ token: env.M5_DATABASE_TOKEN }] }) };
}
test('synthetic fixtures cover tenants, stock modes, manual/multi-shop and guest without financial evidence', async () => {
  const env = generateEnvironment(), { db, rows, counters } = fixtureDatabase();
  const first = await seedFixtures(db, identityPool(env), env, 'ezihubb_m5_upgrade');
  assert.equal(first.seededMigrationHead, BEFORE_M4);
  assert.equal(rows.user.length, 5); assert.equal(rows.store.length, 2); assert.equal(rows.product.length, 6);
  assert(rows.user.every(row => row.passwordHash.startsWith('$2b$')));
  assert(rows.product.some(row => row.trackInventory && row.quantity === 1));
  assert(rows.product.some(row => !row.trackInventory && row.quantity === null));
  assert(rows.product.some(row => row.productType === 'DIGITAL'));
  assert.equal(rows.productVariant[0].quantity, 1);
  assert.equal(rows.storeOrder.length, 2);
  assert.deepEqual(rows.orderItem.map(row => row.quantity), [2, 3]);
  assert.equal(rows.payment.length, 0); assert.equal(rows.sellerLedgerEntry.length, 0);
  assert.equal(rows.economicCapture.length, 0); assert.equal(rows.economicOrderContext.length, 0);
  const before = counters.writes;
  const replay = await seedFixtures(db, identityPool(env), env, 'ezihubb_m5_upgrade');
  assert.notEqual(JSON.stringify(replay), JSON.stringify(first));
  assertFixtureReplayUnchanged(first, replay);
  assert.equal(counters.writes, before, 'replay must not reset fixtures or hashes');
  rows.product[0].quantity = 0;
  await assert.rejects(seedFixtures(db, identityPool(env), env, 'ezihubb_m5_upgrade'), /M5_FIXTURE_CHANGED/);
  assert.equal(counters.writes, before);
});
test('existing data is never adopted or overwritten by seed', async () => {
  const env = generateEnvironment(), { db, rows, counters } = fixtureDatabase();
  rows.user.push({ id: 'historical', email: 'synthetic-looking@ezihubb.test' });
  await assert.rejects(seedFixtures(db, identityPool(env), env, 'ezihubb_m5_upgrade'), /M5_DATABASE_NOT_EMPTY/);
  assert.equal(counters.writes, 0);
});
test('bootstrap protects environment marker in a separate schema with no superuser grant', () => {
  const sql = readFileSync(resolve(__dirname, '../../docker/m5/postgres-init.sql'), 'utf8');
  assert.match(sql, /NOSUPERUSER NOCREATEDB NOCREATEROLE/);
  assert.equal((sql.match(/CREATE DATABASE ezihubb_m5_/g) ?? []).length, 3);
  assert(!/GRANT (?:UPDATE|DELETE|ALL).*m5_guard/.test(sql));
  assert(!/DROP |TRUNCATE /.test(sql));
});
