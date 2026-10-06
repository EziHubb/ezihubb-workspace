import { PGlite, Transaction } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEconomicQuote, EconomicQuote, quoteFingerprint } from '../src/modules/finances/economic-quote';
import { captureJournal, CaptureJournalRow } from '../src/modules/finances/economic-journal';

/** Actual migration SQL on isolated WASM PostgreSQL. NOT multi-session/Prisma proof. */
describe('economic migrations on isolated in-memory PostgreSQL', () => {
  let db: PGlite;
  let serial = 0;
  let suffix: string;
  let hash: string;
  let quote: EconomicQuote;
  before(async () => {
    db = new PGlite();
    await db.waitReady;
    const root = resolve(__dirname, '../../../prisma/migrations');
    const nanoidMigration = readFileSync(resolve(root, '20260901090000_nanoid_primary_keys/migration.sql'), 'utf8');
    // Use the real existing NanoID function; unrelated historic tables are not needed.
    await db.exec(nanoidMigration.slice(0, nanoidMigration.indexOf('ALTER TABLE')));
    await db.exec('CREATE TABLE "Order" ("id" TEXT PRIMARY KEY);');
    await db.exec('CREATE TABLE "SyntheticConsumerEffect" ("eventId" TEXT PRIMARY KEY, "count" INTEGER NOT NULL);');
    for (const migration of ['20261003090000_economic_durable_foundation', '20261003100000_economic_capture_allocations', '20261004090000_economic_balance_payout']) {
      await db.exec(readFileSync(resolve(root, migration, 'migration.sql'), 'utf8'));
    }
  }, { timeout: 60_000 });
  after(async () => { if (db) await db.close(); });
  beforeEach(async () => {
    suffix = String(++serial);
    const initial = buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [{ id: `line${suffix}`, productId: 'product', variantId: null,
        quantity: 1, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
      customerShippingMinor: '0', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] }],
      tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null });
    await seedQuote(initial);
  });
  async function seedQuote(snapshot: EconomicQuote) {
    quote = snapshot;
    hash = quoteFingerprint(quote);
    await db.query('INSERT INTO "Order" ("id") VALUES ($1)', [`order${suffix}`]);
    await db.query(`INSERT INTO "EconomicOrderContext" ("id", "orderId", "provenance", "policyVersion", "currency", "minorExponent", "quoteHash", "quote")
      VALUES ($1, $2, 'TEST', '2026-10-03.v1', 'USD', 2, $3, $4)`, [`ctx${suffix}`, `order${suffix}`, hash, JSON.stringify(quote)]);
    await db.query(`INSERT INTO "EconomicOperation" ("id", "contextId", "provenance", "currency", "provider", "providerAccount", "kind", "idempotencyKey", "requestHash", "amountMinor", "updatedAt")
      VALUES ($1::text, $2, 'TEST', 'USD', 'STRIPE', 'acct_test', 'CAPTURE', $1::text, $3, $4, now())`, [`op${suffix}`, `ctx${suffix}`, hash, quote.customerTotalMinor]);
  }

  async function dispatch() {
    await db.query(`UPDATE "EconomicOperation" SET "state" = 'DISPATCHED', "dispatchToken" = 'token', "dispatchedAt" = now(), "reconcileAfter" = now() + interval '30 seconds' WHERE "id" = $1`, [`op${suffix}`]);
  }
  async function book(tx: Transaction, mutateJournal: (rows: CaptureJournalRow[]) => CaptureJournalRow[] = rows => rows, foreignAllocation = false) {
    await tx.query(`UPDATE "EconomicOperation" SET "state" = 'SUCCEEDED', "providerReference" = $2, "completedAt" = now() WHERE "id" = $1`, [`op${suffix}`, `charge${suffix}`]);
    await tx.query(`INSERT INTO "EconomicCapture" ("id", "contextId", "operationId", "provider", "providerAccount", "provenance", "providerReference", "currency", "amountMinor", "quoteHash", "evidenceHash", "verifiedAt")
      VALUES ($1, $2, $3, 'STRIPE', 'acct_test', 'TEST', $4, 'USD', $6, $5, $5, now())`, [`capture${suffix}`, `ctx${suffix}`, `op${suffix}`, `charge${suffix}`, hash, quote.customerTotalMinor]);
    for (const part of quote.parts) {
      await tx.query(`INSERT INTO "EconomicCaptureAllocation" ("captureId", "partKey", "kind", "storeId", "storeOrderId", "lineId", "quantity", "currency", "customerMinor", "platformFundingMinor", "sellerGrossMinor", "sellerFeeMinor", "sellerNetMinor", "fees")
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'USD', $8, $9, $10, $11, $12, $13)`, [
        `capture${suffix}`, part.key, part.kind, foreignAllocation ? 'foreign' : part.storeId, part.storeOrderId, part.lineId, part.quantity,
        part.customerMinor, part.platformFundingMinor, part.sellerGrossMinor, part.sellerFeeMinor, part.sellerNetMinor, JSON.stringify(part.fees),
      ]);
    }
    for (const row of mutateJournal(captureJournal(quote))) {
      await tx.query(`INSERT INTO "EconomicJournalEntry" ("captureId", "entryKey", "account", "beneficiaryId", "currency", "amountMinor")
        VALUES ($1, $2, $3, $4, $5, $6)`, [`capture${suffix}`, row.entryKey, row.account, row.beneficiaryId, row.currency, row.amountMinor.toString()]);
    }
  }

  async function balanceFixture() {
    await dispatch(); await db.transaction(tx => book(tx));
    await db.query(`INSERT INTO "EconomicBalanceAccount" ("id", "kind", "beneficiaryId", "currency", "provenance", "minorExponent") VALUES ($1, 'SELLER', $2, 'USD', 'TEST', 2)
      ON CONFLICT ("kind", "beneficiaryId", "currency", "provenance") DO NOTHING`, ['balance-store', 'store']);
    await db.query(`INSERT INTO "EconomicBalanceLot" ("id", "accountId", "captureId", "sourceKey", "amountMinor", "eligibleAt") VALUES ($1, 'balance-store', $2, $3, 100, now())`, [`lot${suffix}`, `capture${suffix}`, quote.parts[0].key]);
  }
  async function reserve(tx: Transaction, key: string, amount: number, accountId = 'balance-store') {
    await tx.query(`INSERT INTO "EconomicPayout" ("id", "accountId", "idempotencyKey", "amountMinor", "requestedBy", "destination") VALUES ($1::text, $2, $1::text, $3, 'owner', 'acct_recipient')`, [key, accountId, amount]);
    await tx.query(`INSERT INTO "EconomicPayoutAllocation" ("payoutId", "lotId", "amountMinor") VALUES ($1, $2, $3)`, [key, `lot${suffix}`, amount]);
    await tx.query(`UPDATE "EconomicBalanceLot" SET "reservedMinor" = "reservedMinor" + $2 WHERE "id" = $1`, [`lot${suffix}`, amount]);
  }
  async function settle(tx: Transaction, key: string, amount: number, mode = 'TEST', reference = `transfer${suffix}`) {
    await tx.query(`UPDATE "EconomicPayout" SET "state"='VERIFYING', "verificationStartedAt"=now(), "verificationStartedBy"='operator',
      "transferProvider"='STRIPE', "transferAccount"='acct_platform', "transferProvenance"=$2::"EconomicProvenance", "transferReference"=$3 WHERE "id"=$1`, [key, mode, reference]);
    await tx.query(`UPDATE "EconomicPayout" SET "state"='PAID', "processedAt"=now(), "processedBy"='operator',
      "transferProvider"='STRIPE', "transferAccount"='acct_platform', "transferProvenance"=$2::"EconomicProvenance", "transferReference"=$3, "transferEvidenceHash"=$4 WHERE "id"=$1`, [key, mode, reference, hash]);
    await tx.query(`UPDATE "EconomicBalanceLot" SET "reservedMinor"="reservedMinor"-$2, "paidMinor"="paidMinor"+$2 WHERE "id"=$1`, [`lot${suffix}`, amount]);
  }

  it('reserves and settles only the selected fraction, releases only a rejected payout and protects terminal evidence', async () => {
    await balanceFixture();
    const first = `payout-a${suffix}`, second = `payout-b${suffix}`;
    await db.transaction(tx => reserve(tx, first, 30));
    await db.transaction(tx => reserve(tx, second, 40));
    await db.transaction(tx => settle(tx, first, 30));
    let lot = (await db.query<{ reserved: string; paid: string }>(`SELECT "reservedMinor"::text AS reserved, "paidMinor"::text AS paid FROM "EconomicBalanceLot" WHERE "id"=$1`, [`lot${suffix}`])).rows[0];
    assert.deepEqual(lot, { reserved: '40', paid: '30' });
    await db.transaction(async tx => {
      await tx.query(`UPDATE "EconomicPayout" SET "state"='REJECTED', "processedAt"=now(), "processedBy"='operator', "rejectionReason"='Requested by owner' WHERE "id"=$1`, [second]);
      await tx.query(`UPDATE "EconomicBalanceLot" SET "reservedMinor"="reservedMinor"-40 WHERE "id"=$1`, [`lot${suffix}`]);
    });
    lot = (await db.query<{ reserved: string; paid: string }>(`SELECT "reservedMinor"::text AS reserved, "paidMinor"::text AS paid FROM "EconomicBalanceLot" WHERE "id"=$1`, [`lot${suffix}`])).rows[0];
    assert.deepEqual(lot, { reserved: '0', paid: '30' });
    await assert.rejects(db.query(`UPDATE "EconomicPayout" SET "state"='REJECTED' WHERE "id"=$1`, [first]), /Terminal payout/);
    await assert.rejects(db.query(`DELETE FROM "EconomicPayoutAllocation" WHERE "payoutId"=$1`, [second]), /immutable/);
  });

  it('rolls back over-reservation, missing allocations and mismatched counters', async () => {
    await balanceFixture();
    await db.transaction(tx => reserve(tx, `first${suffix}`, 60));
    await assert.rejects(db.transaction(tx => reserve(tx, `overflow${suffix}`, 41)));
    assert.equal((await db.query(`SELECT "id" FROM "EconomicPayout" WHERE "id"=$1`, [`overflow${suffix}`])).rows.length, 0);
    await assert.rejects(db.query(`INSERT INTO "EconomicPayout" ("accountId", "idempotencyKey", "amountMinor", "requestedBy", "destination") VALUES ('balance-store', $1, 20, 'owner', 'recipient')`, [`missing${suffix}`]), /allocation mismatch/);
    await assert.rejects(db.query(`UPDATE "EconomicBalanceLot" SET "reservedMinor"=0 WHERE "id"=$1`, [`lot${suffix}`]), /counters do not conserve/);
    await assert.rejects(db.query(`UPDATE "EconomicPayout" SET "state"='REJECTED', "processedAt"=now(), "processedBy"='operator' WHERE "id"=$1`, [`first${suffix}`]));
  });

  it('refuses foreign-tenant lots, wrong settlement mode, duplicate transfer evidence and fake captured credit', async () => {
    await balanceFixture();
    await db.query(`INSERT INTO "EconomicBalanceAccount" ("id", "kind", "beneficiaryId", "currency", "provenance", "minorExponent") VALUES ($1, 'SELLER', $1, 'USD', 'TEST', 2)`, [`foreign${suffix}`]);
    await assert.rejects(db.transaction(tx => reserve(tx, `foreign-payout${suffix}`, 20, `foreign${suffix}`)), /allocation mismatch/);
    await assert.rejects(db.query(`INSERT INTO "EconomicBalanceLot" ("accountId", "captureId", "sourceKey", "amountMinor") VALUES ($1, $2, $3, 100)`, [`foreign${suffix}`, `capture${suffix}`, quote.parts[0].key]), /captured liability/);
    await db.transaction(tx => reserve(tx, `first${suffix}`, 30));
    await db.transaction(tx => reserve(tx, `second${suffix}`, 30));
    await assert.rejects(db.transaction(tx => settle(tx, `first${suffix}`, 30, 'LIVE')), /allocation mismatch/);
    await db.transaction(tx => settle(tx, `first${suffix}`, 30));
    await assert.rejects(db.transaction(tx => settle(tx, `second${suffix}`, 30)), /unique constraint/);
    assert.equal((await db.query<{ state: string }>(`SELECT "state" FROM "EconomicPayout" WHERE "id"=$1`, [`second${suffix}`])).rows[0].state, 'REQUESTED');
  });

  it('keeps a timed-out transfer lookup reserved and forbids rejection, rebinding or rewriting its actor', async () => {
    await balanceFixture();
    const key = `verifying${suffix}`;
    await db.transaction(tx => reserve(tx, key, 60));
    await db.query(`UPDATE "EconomicPayout" SET "state"='VERIFYING', "verificationStartedAt"=now(), "verificationStartedBy"='operator',
      "transferProvider"='STRIPE', "transferAccount"='acct_platform', "transferProvenance"='TEST', "transferReference"=$2 WHERE "id"=$1`, [key, `transfer${suffix}`]);
    await assert.rejects(db.query(`UPDATE "EconomicPayout" SET "state"='REJECTED', "processedAt"=now(), "processedBy"='operator', "rejectionReason"='Timeout' WHERE "id"=$1`, [key]), /transition/);
    await assert.rejects(db.query(`UPDATE "EconomicPayout" SET "transferReference"='replacement' WHERE "id"=$1`, [key]), /immutable/);
    await assert.rejects(db.query(`UPDATE "EconomicPayout" SET "verificationStartedBy"='replacement' WHERE "id"=$1`, [key]), /immutable/);
    await assert.rejects(db.query(`UPDATE "EconomicBalanceLot" SET "reservedMinor"=0 WHERE "id"=$1`, [`lot${suffix}`]), /counters do not conserve/);
    assert.equal((await db.query<{ reserved: string }>(`SELECT "reservedMinor"::text AS reserved FROM "EconomicBalanceLot" WHERE "id"=$1`, [`lot${suffix}`])).rows[0].reserved, '60');
  });

  it('enforces immutable quotes, legacy order deletion protection and amount/mode constraints', async () => {
    await assert.rejects(db.query('UPDATE "EconomicOrderContext" SET "currency" = $1 WHERE "id" = $2', ['EUR', `ctx${suffix}`]), /immutable/);
    await assert.rejects(db.query('DELETE FROM "Order" WHERE "id" = $1', [`order${suffix}`]));
    await assert.rejects(db.query('UPDATE "EconomicOperation" SET "amountMinor" = -1 WHERE "id" = $1', [`op${suffix}`]));
    await assert.rejects(db.query(`INSERT INTO "EconomicOperation" ("contextId", "provenance", "currency", "provider", "providerAccount", "kind", "idempotencyKey", "requestHash", "amountMinor", "updatedAt")
      VALUES ($1, 'LIVE', 'USD', 'STRIPE', 'acct_test', 'CAPTURE', 'bad-mode', $2, 100, now())`, [`ctx${suffix}`, hash]));
  });

  it('refuses dispatch without evidence and never resets an ambiguous operation for blind retry', async () => {
    await assert.rejects(db.query(`UPDATE "EconomicOperation" SET "state" = 'DISPATCHED' WHERE "id" = $1`, [`op${suffix}`]));
    await dispatch();
    await db.query(`UPDATE "EconomicOperation" SET "state" = 'NEEDS_RECONCILIATION' WHERE "id" = $1`, [`op${suffix}`]);
    await assert.rejects(db.query(`UPDATE "EconomicOperation" SET "state" = 'PREPARED' WHERE "id" = $1`, [`op${suffix}`]), /transition/);
  });

  it('commits a balanced capture, checks generated 12-character IDs and protects evidence from edits/deletion', async () => {
    await dispatch(); await db.transaction(tx => book(tx));
    const entries = await db.query<{ id: string }>('SELECT "id" FROM "EconomicJournalEntry" WHERE "captureId" = $1', [`capture${suffix}`]);
    assert.equal(entries.rows.length, 2);
    assert.ok(entries.rows.every(row => /^[A-Za-z0-9]{12}$/.test(row.id)));
    await assert.rejects(db.query('DELETE FROM "EconomicCapture" WHERE "id" = $1', [`capture${suffix}`]), /immutable/);
    await assert.rejects(db.query('UPDATE "EconomicJournalEntry" SET "amountMinor" = 1 WHERE "captureId" = $1', [`capture${suffix}`]), /immutable/);
  });

  it('rejects an unbalanced journal at COMMIT and rolls operation/capture/allocation back together', async () => {
    await dispatch();
    await assert.rejects(db.transaction(tx => book(tx, rows => rows.map(row => row.account === 'SELLER_PAYABLE' ? { ...row, amountMinor: -99n } : row))), /does not conserve/);
    assert.equal((await db.query<{ state: string }>('SELECT "state" FROM "EconomicOperation" WHERE "id" = $1', [`op${suffix}`])).rows[0].state, 'DISPATCHED');
    assert.equal((await db.query('SELECT "id" FROM "EconomicCapture" WHERE "id" = $1', [`capture${suffix}`])).rows.length, 0);
    assert.equal((await db.query('SELECT "id" FROM "EconomicJournalEntry" WHERE "captureId" = $1', [`capture${suffix}`])).rows.length, 0);
    await assert.doesNotReject(db.transaction(tx => book(tx)));
  });

  it('rejects missing journal, foreign shop allocations and offsetting fake entries even when balanced', async () => {
    await dispatch();
    await assert.rejects(db.transaction(tx => book(tx, () => [])), /does not conserve/);
    await assert.rejects(db.transaction(tx => book(tx, rows => rows, true)), /differ from frozen quote/);
    await assert.rejects(db.transaction(tx => book(tx, rows => [...rows,
      { entryKey: 'fake-debit', account: 'PLATFORM_FEES', beneficiaryId: null, currency: 'USD', amountMinor: 1n },
      { entryKey: 'fake-credit', account: 'PLATFORM_FEES', beneficiaryId: null, currency: 'USD', amountMinor: -1n },
    ])), /journal accounts or beneficiaries/);
    await assert.doesNotReject(db.transaction(tx => book(tx)));
  });

  it('books multi-shop quantities, funding, shipping, gift wrap, VAT and affiliate without misclassifying money', async () => {
    suffix += 'mixed';
    await seedQuote(buildEconomicQuote({
      orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [
        { storeId: 'store-a', storeOrderId: `shop-a${suffix}`, lines: [
          { id: `line-a${suffix}`, productId: 'p-a', variantId: 'v-a', quantity: 2, unitPriceMinor: '1000', sellerDiscountMinor: '100', platformDiscountMinor: '200' },
        ], customerShippingMinor: '0', expectedShippingSubsidyMinor: '500', giftWrapMinor: '100', fees: [
          { code: 'TRANSACTION_FEE', amountMinor: '101', ruleReference: 'synthetic' },
          { code: 'VAT', amountMinor: '10', ruleReference: 'synthetic-vat' },
        ] },
        { storeId: 'store-b', storeOrderId: `shop-b${suffix}`, lines: [
          { id: `line-b${suffix}`, productId: 'p-b', variantId: null, quantity: 3, unitPriceMinor: '333', sellerDiscountMinor: '0', platformDiscountMinor: '0' },
        ], customerShippingMinor: '500', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] },
      ], tax: { amountMinor: '50', ruleReference: 'synthetic-tax' },
      affiliate: { id: 'affiliate-a', commissionMinor: '100', rate: '0.05', lockDays: 7, ruleReference: 'synthetic-affiliate' },
    }));
    assert.equal(quote.customerTotalMinor, '3349');
    assert.equal(quote.sellerNetMinor, '3388');
    await dispatch();
    // Same total, wrong liability destination: both must fail at COMMIT.
    await assert.rejects(db.transaction(tx => book(tx, rows => rows.map(row => row.account === 'TAX_PAYABLE'
      ? { ...row, account: 'PLATFORM_FEES' } : row))), /journal accounts or beneficiaries/);
    await assert.rejects(db.transaction(tx => book(tx, rows => rows.map(row => row.account === 'AFFILIATE_PENDING'
      ? { ...row, beneficiaryId: 'foreign-affiliate' } : row))), /journal accounts or beneficiaries/);
    await assert.doesNotReject(db.transaction(tx => book(tx)));
    const funds = await db.query<{ account: string; amount: string }>(`SELECT "account", sum("amountMinor")::text AS amount FROM "EconomicJournalEntry" WHERE "captureId" = $1 GROUP BY "account"`, [`capture${suffix}`]);
    const totals = Object.fromEntries(funds.rows.map(row => [row.account, row.amount]));
    assert.equal(totals.TAX_PAYABLE, '-60');
    assert.equal(totals.PLATFORM_FEES, '-101');
    assert.equal(totals.PLATFORM_PROMOTION, '200'); // NOT 200 + expected shipping 500
    assert.equal(totals.SELLER_PAYABLE, '-3388');
  });

  it('rejects capture evidence from a different provider account before inserting allocations', async () => {
    await dispatch();
    await assert.rejects(db.transaction(async tx => {
      await tx.query(`UPDATE "EconomicOperation" SET "state" = 'SUCCEEDED', "providerReference" = $2, "completedAt" = now() WHERE "id" = $1`, [`op${suffix}`, `charge${suffix}`]);
      await tx.query(`INSERT INTO "EconomicCapture" ("contextId", "operationId", "provider", "providerAccount", "provenance", "providerReference", "currency", "amountMinor", "quoteHash", "evidenceHash", "verifiedAt")
        VALUES ($1, $2, 'STRIPE', 'acct_foreign', 'TEST', $3, 'USD', 100, $4, $4, now())`, [`ctx${suffix}`, `op${suffix}`, `charge${suffix}`, hash]);
    }), /Capture identity/);
    assert.equal((await db.query('SELECT "id" FROM "EconomicCapture" WHERE "contextId" = $1', [`ctx${suffix}`])).rows.length, 0);
  });

  it('rolls a consumer receipt back with its failed effect and deduplicates successful retries', async () => {
    await db.query(`INSERT INTO "EconomicOutbox" ("id", "contextId", "eventKey", "eventType", "payload") VALUES ($1::text, $2, $1::text, 'capture.verified.v1', '{}')`, [`event${suffix}`, `ctx${suffix}`]);
    const consume = async (fail: boolean) => db.transaction(async tx => {
      const receipt = await tx.query(`INSERT INTO "EconomicConsumerReceipt" ("eventId", "consumer") VALUES ($1, 'test-consumer') ON CONFLICT DO NOTHING RETURNING "id"`, [`event${suffix}`]);
      if (!receipt.rows.length) return false;
      await tx.query(`INSERT INTO "SyntheticConsumerEffect" ("eventId", "count") VALUES ($1, 1)
        ON CONFLICT ("eventId") DO UPDATE SET "count" = "SyntheticConsumerEffect"."count" + 1`, [`event${suffix}`]);
      if (fail) throw new Error('synthetic effect failure');
      return true;
    });
    await assert.rejects(consume(true), /synthetic effect/);
    assert.equal((await db.query('SELECT * FROM "SyntheticConsumerEffect" WHERE "eventId" = $1', [`event${suffix}`])).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM "EconomicConsumerReceipt" WHERE "eventId" = $1', [`event${suffix}`])).rows.length, 0);
    assert.equal(await consume(false), true);
    assert.equal(await consume(false), false);
    assert.equal((await db.query<{ count: number }>('SELECT "count" FROM "SyntheticConsumerEffect" WHERE "eventId" = $1', [`event${suffix}`])).rows[0].count, 1);
  });

  it('keeps reservation pool/quantity immutable and rejects restocking consumed stock by changing its state', async () => {
    await db.query(`INSERT INTO "EconomicInventoryReservation" ("id", "contextId", "productId", "variantId", "poolKey", "target", "quantity", "lines", "expiresAt")
      VALUES ($1, $2, 'product', 'variant', 'variant:variant', 'VARIANT', 2, '[]', now() + interval '15 minutes')`, [`reservation${suffix}`, `ctx${suffix}`]);
    await assert.rejects(db.query(`UPDATE "EconomicInventoryReservation" SET "quantity" = 1 WHERE "id" = $1`, [`reservation${suffix}`]), /immutable/);
    await assert.rejects(db.query(`UPDATE "EconomicInventoryReservation" SET "variantId" = 'other' WHERE "id" = $1`, [`reservation${suffix}`]), /immutable/);
    await assert.rejects(db.query(`UPDATE "EconomicInventoryReservation" SET "state" = 'CONSUMED' WHERE "id" = $1`, [`reservation${suffix}`]));
    await db.query(`UPDATE "EconomicInventoryReservation" SET "state" = 'CONSUMED', "consumedAt" = now() WHERE "id" = $1`, [`reservation${suffix}`]);
    await assert.rejects(db.query(`UPDATE "EconomicInventoryReservation" SET "state" = 'RELEASED', "releasedAt" = now() WHERE "id" = $1`, [`reservation${suffix}`]), /Consumed inventory/);
    await assert.rejects(db.query(`DELETE FROM "EconomicInventoryReservation" WHERE "id" = $1`, [`reservation${suffix}`]), /immutable/);
  });

  it('prevents duplicate request identities and booking a capture twice for one context', async () => {
    await assert.rejects(db.query(`INSERT INTO "EconomicOperation" ("contextId", "provenance", "currency", "provider", "providerAccount", "kind", "idempotencyKey", "requestHash", "amountMinor", "updatedAt")
      VALUES ($1, 'TEST', 'USD', 'STRIPE', 'acct_test', 'CAPTURE', $2, $3, 100, now())`, [`ctx${suffix}`, `op${suffix}`, hash]), /unique constraint/);
    await dispatch(); await db.transaction(tx => book(tx));
    await assert.rejects(db.query(`INSERT INTO "EconomicCapture" ("contextId", "operationId", "provider", "providerAccount", "provenance", "providerReference", "currency", "amountMinor", "quoteHash", "evidenceHash", "verifiedAt")
      VALUES ($1, $2, 'STRIPE', 'acct_test', 'TEST', $3, 'USD', 100, $4, $4, now())`, [`ctx${suffix}`, `op${suffix}`, `charge${suffix}`, hash]), /unique constraint/);
    assert.equal((await db.query('SELECT "id" FROM "EconomicCapture" WHERE "contextId" = $1', [`ctx${suffix}`])).rows.length, 1);
  });

  it('enforces fenced lease state shape, attempt increments and immutable terminal events', async () => {
    await db.query(`INSERT INTO "EconomicOutbox" ("id", "contextId", "eventKey", "eventType", "payload") VALUES ($1::text, $2, $1::text, 'capture.verified.v1', '{}')`, [`event${suffix}`, `ctx${suffix}`]);
    await assert.rejects(db.query(`UPDATE "EconomicOutbox" SET "state" = 'CLAIMED' WHERE "id" = $1`, [`event${suffix}`]));
    await db.query(`UPDATE "EconomicOutbox" SET "state" = 'CLAIMED', "attempts" = 1, "leaseToken" = 'lease1', "leaseUntil" = now() + interval '30 seconds' WHERE "id" = $1`, [`event${suffix}`]);
    const stale = await db.query(`UPDATE "EconomicOutbox" SET "state" = 'PUBLISHED', "leaseToken" = NULL, "leaseUntil" = NULL, "publishedAt" = now() WHERE "id" = $1 AND "leaseToken" = 'stale' RETURNING "id"`, [`event${suffix}`]);
    assert.equal(stale.rows.length, 0);
    await db.query(`UPDATE "EconomicOutbox" SET "state" = 'PUBLISHED', "leaseToken" = NULL, "leaseUntil" = NULL, "publishedAt" = now() WHERE "id" = $1 AND "leaseToken" = 'lease1'`, [`event${suffix}`]);
    await assert.rejects(db.query(`UPDATE "EconomicOutbox" SET "state" = 'PENDING' WHERE "id" = $1`, [`event${suffix}`]), /Terminal/);
  });
});
