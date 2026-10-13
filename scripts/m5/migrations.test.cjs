const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { migrationManifest, BEFORE_M4 } = require('./guard.cjs');
const { schemaCatalog, expectedSchemaCatalog } = require('./schema-contract.cjs');

// Full history syntax/ordering smoke ONLY. Not native PG, Prisma or concurrency.
test('entire additive migration chain executes on disposable WASM PostgreSQL', { timeout: 90_000 }, async () => {
  const root = resolve(__dirname, '../..');
  const db = new PGlite();
  await db.waitReady;
  try {
    const manifest = migrationManifest(root);
    for (const entry of manifest) {
      try { await db.exec(readFileSync(resolve(root, 'prisma/migrations', entry.name, 'migration.sql'), 'utf8')); }
      catch { throw new Error(`M5_SQL_CHAIN_FAILED:${entry.name}`); }
      if (entry.name === BEFORE_M4) {
        await db.exec(`INSERT INTO "User" ("email","updatedAt","backupCodes","adminTags") VALUES ('before-m4@ezihubb.test',now(),'{}','{}');`);
      }
    }
    const user = (await db.query('SELECT id,email FROM "User"')).rows[0];
    assert.match(user.id, /^[A-Za-z0-9]{12}$/);
    assert.equal(user.email, 'before-m4@ezihubb.test');
    for (const name of ['EconomicOrderContext', 'EconomicCapture', 'EconomicRefund', 'EconomicOutbox', 'EconomicConsumerReceipt', 'TrackingDeliveryReceipt', 'OrderEventOutbox']) {
      assert((await db.query('SELECT to_regclass($1) AS relation', [`public."${name}"`])).rows[0].relation, `missing ${name}`);
    }
    // Receipt ownership deliberately survives order removal. This is SQL
    // uniqueness/default coverage, not native webhook concurrency evidence.
    const receipt = (await db.query('INSERT INTO "TrackingDeliveryReceipt" ("eventHash", "orderId") VALUES ($1, $2) RETURNING id', ['unit-hash', 'removed-order'])).rows[0];
    assert.match(receipt.id, /^[A-Za-z0-9]{12}$/);
    await assert.rejects(db.query('INSERT INTO "TrackingDeliveryReceipt" ("eventHash", "orderId") VALUES ($1, $2)', ['unit-hash', 'another-order']), error => error.code === '23505');
    const intent = (await db.query('INSERT INTO "OrderEventOutbox" ("eventType", "orderId") VALUES ($1, $2) RETURNING id,state', ['ORDER_PAID', 'removed-order'])).rows[0];
    assert.match(intent.id, /^[A-Za-z0-9]{12}$/); assert.equal(intent.state, 'PENDING');
    await assert.rejects(db.query('INSERT INTO "OrderEventOutbox" ("eventType", "orderId") VALUES ($1, $2)', ['ORDER_PAID', 'removed-order']), error => error.code === '23505');
    await db.exec('BEGIN');
    await db.query('INSERT INTO "TrackingDeliveryReceipt" ("eventHash", "orderId") VALUES ($1, $2)', ['rollback-hash', 'rollback-order']);
    await db.query('INSERT INTO "OrderEventOutbox" ("eventType", "orderId") VALUES ($1, $2)', ['ORDER_DELIVERED', 'rollback-order']);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "OrderEventOutbox" WHERE "orderId"=$1', ['rollback-order'])).rows[0].count, 0);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM "TrackingDeliveryReceipt" WHERE "eventHash"=$1', ['rollback-hash'])).rows[0].count, 0);
    // Compare actual replayed FKs/indexes with Prisma's generated schema, not
    // two hand-maintained lists that can agree while both are wrong.
    const expected = await expectedSchemaCatalog(root);
    assert.deepEqual(await schemaCatalog(db), expected);
    // Negative controls: missing constraints, renamed indexes and weakened
    // manual uniqueness must all be detected rather than silently normalized.
    for (const mutation of [
      'ALTER TABLE "EconomicExternalEffect" DROP CONSTRAINT "EconomicExternalEffect_contextId_fkey"',
      'ALTER INDEX "EconomicRefundJournalEntry_account_beneficiary_currency_idx" RENAME TO "unexpected_refund_index"',
      'DROP INDEX "Conversation_store_guest_key"',
    ]) {
      await db.exec('BEGIN');
      try {
        await db.exec(mutation);
        assert.notDeepEqual(await schemaCatalog(db), expected);
      } finally { await db.exec('ROLLBACK'); }
    }
    assert.deepEqual(await schemaCatalog(db), expected);
  } finally { await db.close(); }
});
