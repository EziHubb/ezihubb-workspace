const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { migrationManifest, BEFORE_M4 } = require('./guard.cjs');

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
    for (const name of ['EconomicOrderContext', 'EconomicCapture', 'EconomicRefund', 'EconomicOutbox', 'EconomicConsumerReceipt', 'TrackingDeliveryReceipt']) {
      assert((await db.query('SELECT to_regclass($1) AS relation', [`public."${name}"`])).rows[0].relation, `missing ${name}`);
    }
    // Receipt ownership deliberately survives order removal. This is SQL
    // uniqueness/default coverage, not native webhook concurrency evidence.
    const receipt = (await db.query('INSERT INTO "TrackingDeliveryReceipt" ("eventHash", "orderId") VALUES ($1, $2) RETURNING id', ['unit-hash', 'removed-order'])).rows[0];
    assert.match(receipt.id, /^[A-Za-z0-9]{12}$/);
    await assert.rejects(db.query('INSERT INTO "TrackingDeliveryReceipt" ("eventHash", "orderId") VALUES ($1, $2)', ['unit-hash', 'another-order']), error => error.code === '23505');
  } finally { await db.close(); }
});
