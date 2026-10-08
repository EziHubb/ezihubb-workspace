import { PGlite } from '@electric-sql/pglite';
import { Prisma, PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { readLegacyRevenueSeries } from '../src/modules/finances/legacy-revenue-series';

/** Execute the actual reader's parameterized SQL on isolated WASM PostgreSQL.
 * Minimal synthetic historical tables, NOT Prisma/network/multi-session proof. */
describe('historical shop revenue SQL scope', () => {
  let db: PGlite;
  const start = new Date('2026-10-08T00:00:00Z');
  const end = new Date('2026-10-09T00:00:00Z');
  let reader: Pick<PrismaClient, '$queryRaw'>;
  before(async () => {
    db = new PGlite();
    await db.waitReady;
    await db.exec(`
      CREATE TABLE "Order" (id TEXT PRIMARY KEY, status TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL, total NUMERIC(10,2) NOT NULL, "adminArchivedAt" TIMESTAMP(3));
      CREATE TABLE "Payment" ("orderId" TEXT UNIQUE NOT NULL, status TEXT NOT NULL);
      CREATE TABLE "StoreOrder" (id TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "storeId" TEXT NOT NULL,
        status TEXT NOT NULL, subtotal NUMERIC(10,2) NOT NULL, "discountAmount" NUMERIC(10,2) NOT NULL,
        "shippingCost" NUMERIC(10,2) NOT NULL, "shippingSubsidy" NUMERIC(10,2) NOT NULL,
        UNIQUE ("orderId", "storeId"));
      CREATE TABLE "EconomicOrderContext" ("orderId" TEXT UNIQUE NOT NULL, provenance TEXT NOT NULL);
    `);
    reader = { $queryRaw: async (query: Prisma.Sql) => (await db.query(query.text,
      query.values.map((value) => value instanceof Date ? value.toISOString() : value))).rows,
    } as Pick<PrismaClient, '$queryRaw'>;
  }, { timeout: 30_000 });
  after(async () => { if (db) await db.close(); });
  beforeEach(async () => {
    await db.exec(`TRUNCATE "Order", "Payment", "StoreOrder", "EconomicOrderContext";
      SET TIME ZONE 'UTC';
      INSERT INTO "Order" VALUES ('multi','CONFIRMED','2026-10-08 23:55:00',135.00,NULL);
      INSERT INTO "Payment" VALUES ('multi','PAID');
      INSERT INTO "StoreOrder" VALUES
        ('a','multi','shop-a','CONFIRMED',20.00,2.00,10.00,7.00),
        ('b','multi','shop-b','CONFIRMED',100.00,0.00,4.00,0.00);
    `);
  });
  it('does not leak another shop or order-level extras and subtracts platform shipping support', async () => {
    assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0].revenue,21);
    assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-b'))[0].revenue,104);
    const platform = await readLegacyRevenueSeries(reader,start,end);
    assert.equal(platform[0].revenue,135);
    assert.equal(platform[0].orders,1); // one parent, not two joined shops
  });
  it('excludes LIVE and TEST contexts even when their old payment receipts say PAID', async () => {
    for (const mode of ['LIVE','TEST']) {
      const id = `versioned-${mode}`;
      await db.query(`INSERT INTO "Order" VALUES ($1,'CONFIRMED','2026-10-08 13:00:00',999.00,NULL)`,[id]);
      await db.query(`INSERT INTO "Payment" VALUES ($1,'PAID')`,[id]);
      await db.query(`INSERT INTO "StoreOrder" VALUES ($1,$1,'shop-a','CONFIRMED',999.00,0,0,0)`,[id]);
      await db.query(`INSERT INTO "EconomicOrderContext" VALUES ($1,$2)`,[id,mode]);
    }
    assert.deepEqual((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0],{ date:'2026-10-08',orders:1,revenue:21 });
    assert.deepEqual((await readLegacyRevenueSeries(reader,start,end))[0],{ date:'2026-10-08',orders:1,revenue:135 });
  });
  it('keeps archived financial history but excludes cancelled and refunded parent receipts', async () => {
    await db.exec(`UPDATE "Order" SET "adminArchivedAt"='2026-10-08 23:59:00'`);
    assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0].revenue,21);
    for (const status of ['CANCELLED','REFUNDED']) {
      await db.query(`UPDATE "Order" SET status=$1`,[status]);
      assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0].orders,0);
      assert.equal((await readLegacyRevenueSeries(reader,start,end))[0].revenue,0);
    }
  });
  it('excludes a cancelled/refunded shop even while the multi-shop parent stays confirmed', async () => {
    for (const status of ['CANCELLED','REFUNDED']) {
      await db.query(`UPDATE "StoreOrder" SET status=$1 WHERE "storeId"='shop-a'`,[status]);
      assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0].orders,0);
      assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0].revenue,0);
      assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-b'))[0].revenue,104);
    }
  });
  it('counts unpaid requests without inventing collected revenue, including absent receipts', async () => {
    await db.exec(`UPDATE "Payment" SET status='PENDING'`);
    assert.deepEqual((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0],{ date:'2026-10-08',orders:1,revenue:0 });
    await db.exec(`DELETE FROM "Payment"`);
    assert.deepEqual((await readLegacyRevenueSeries(reader,start,end))[0],{ date:'2026-10-08',orders:1,revenue:0 });
  });
  it('uses the same exact time window and UTC grouping regardless of database session timezone', async () => {
    await db.exec(`SET TIME ZONE 'Asia/Bangkok'`);
    assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0].revenue,21);
    assert.equal((await readLegacyRevenueSeries(reader,start,new Date('2026-10-08T23:54:59Z'),'shop-a'))[0].revenue,0);
    assert.equal((await readLegacyRevenueSeries(reader,new Date('2026-10-08T23:55:01Z'),end,'shop-a'))[0].revenue,0);
  });
  it('does not allow injected shop identifiers or negative customer shipping from excess support', async () => {
    assert.equal((await readLegacyRevenueSeries(reader,start,end,"shop-a' OR true --"))[0].orders,0);
    await db.exec(`UPDATE "StoreOrder" SET "shippingSubsidy"=20 WHERE "storeId"='shop-a'`);
    assert.equal((await readLegacyRevenueSeries(reader,start,end,'shop-a'))[0].revenue,18);
  });
});
