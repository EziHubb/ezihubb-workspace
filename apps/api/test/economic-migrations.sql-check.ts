import { PGlite, Transaction } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEconomicQuote, EconomicQuote, quoteFingerprint } from '../src/modules/finances/economic-quote';
import { captureJournal, CaptureJournalRow } from '../src/modules/finances/economic-journal';
import { EconomicRefundPlan, GIFT_WRAP_REFUND_POLICY, planQuantityRefund, planShippingOverride, SHIPPING_REFUND_POLICY, ShippingRefundEligibility } from '../src/modules/finances/economic-refund-plan';
import { plannedRefundJournal, RefundJournalRow } from '../src/modules/finances/economic-refund-journal';

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
    await db.exec(`CREATE TYPE "OrderStatus" AS ENUM ('CONFIRMED','PENDING_PAYMENT');
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "status" TEXT NOT NULL DEFAULT 'CONFIRMED', "adminArchivedAt" TIMESTAMP(3), "orderNumber" TEXT, "total" NUMERIC(10,2), "shippedAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3));
      CREATE TABLE "Payment" ("orderId" TEXT PRIMARY KEY, "status" TEXT NOT NULL DEFAULT 'PAID');
      CREATE TABLE "StoreOrder" ("id" TEXT PRIMARY KEY, "orderId" TEXT, "storeId" TEXT, "status" TEXT NOT NULL DEFAULT 'CONFIRMED', "deliveredAt" TIMESTAMP(3), "shippedAt" TIMESTAMP(3), "trackingNumber" TEXT, "trackingUrl" TEXT, "carrier" TEXT);
      CREATE TABLE "StoreOrderFulfillment" ("storeOrderId" TEXT);
      CREATE TABLE "StoreFulfillmentConnection" ("id" TEXT PRIMARY KEY, "storeId" TEXT, "provider" TEXT, "status" TEXT, "externalShopId" TEXT);
      CREATE TABLE "Notification" ("id" TEXT PRIMARY KEY, "userId" TEXT, "data" JSONB);
      CREATE TABLE "OrderStatusHistory" ("orderId" TEXT, "status" TEXT);`);
    await db.exec('CREATE TABLE "SyntheticConsumerEffect" ("eventId" TEXT PRIMARY KEY, "count" INTEGER NOT NULL);');
    for (const migration of ['20261003090000_economic_durable_foundation', '20261003100000_economic_capture_allocations', '20261004090000_economic_balance_payout', '20261007100000_economic_refund_intents', '20261008100000_economic_refund_settlement', '20261008110000_economic_inventory_reacquisition', '20261008120000_economic_lifecycle_recovery', '20261008130000_economic_gift_wrap_approval', '20261008140000_checkout_request_identity', '20261008150000_economic_shipping_refund', '20261008160000_economic_external_effects', '20261008170000_economic_shipping_override']) {
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
    await db.query('INSERT INTO "Payment" ("orderId") VALUES ($1)', [`order${suffix}`]);
    for (const shop of quote.stores) await db.query('INSERT INTO "StoreOrder" ("id","orderId","storeId") VALUES ($1,$2,$3)', [shop.storeOrderId, `order${suffix}`, shop.storeId]);
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

  async function refundIntent(tx: Transaction, key: string, mutate = (plan: ReturnType<typeof planQuantityRefund>) => plan,
    previous: ReadonlyMap<string, number> = new Map(), mutateJournal = (journal: RefundJournalRow[]) => journal,
    selection = [{ partKey: quote.parts[0].key, quantity: 1 }], approveGiftWrap = false, shippingEligibility?: ShippingRefundEligibility, overridePlan?: EconomicRefundPlan) {
    const originalPlan = overridePlan ?? planQuantityRefund(quote, selection, previous, approveGiftWrap
      ? { policy: GIFT_WRAP_REFUND_POLICY, approvedBy: 'operator', reason: 'Synthetic return' } : undefined, shippingEligibility);
    const journal = mutateJournal(plannedRefundJournal(originalPlan, quote));
    const plan = mutate(originalPlan);
    await tx.query(`INSERT INTO "EconomicOperation" ("id","contextId","provider","providerAccount","provenance","currency","kind","idempotencyKey","requestHash","amountMinor","updatedAt")
      VALUES ($1::text,$2,'STRIPE','acct_test','TEST','USD','REFUND',$1::text,$3,$4,now())`, [key, `ctx${suffix}`, hash, plan.customerMinor]);
    await tx.query(`INSERT INTO "EconomicRefundRequest" ("id","captureId","operationId","requestedBy","reason","plan","plannedJournal","platformRoundingMinor")
      VALUES ($1,$2,$1,'operator','Synthetic return',$3,$4,$5)`, [key, `capture${suffix}`, JSON.stringify(plan), JSON.stringify(journal), plan.platformRoundingMinor]);
  }

  // Synthetic independently-verified settlement fixture, NOT provider evidence.
  // Exercises the real SQL journal, reversal and debt guards atomically.
  async function refundSettlement(tx: Transaction, key: string, omitJournal = false, forgedDebt = false) {
    const request = (await tx.query<{ plan: ReturnType<typeof planQuantityRefund>; journal: RefundJournalRow[] }>(
      `SELECT "plan", "plannedJournal" AS journal FROM "EconomicRefundRequest" WHERE "id"=$1`, [key])).rows[0];
    const now = new Date('2026-10-08T00:00:00Z');
    await tx.query(`UPDATE "EconomicOperation" SET "state"='SUCCEEDED',"providerReference"=$2,"completedAt"=$3 WHERE "id"=$1`, [key, `re_${key}`, now]);
    await tx.query(`INSERT INTO "EconomicRefund" ("id","requestId","providerReference","evidenceHash","amountMinor","verifiedBy","verifiedAt")
      VALUES ($1,$1,$2,$3,$4,'synthetic-verifier',$5)`, [key, `re_${key}`, hash, request.plan.customerMinor, now]);
    for (const row of omitJournal ? [] : request.journal) {
      await tx.query(`INSERT INTO "EconomicRefundJournalEntry" ("refundId","entryKey","account","beneficiaryId","currency","amountMinor")
        VALUES ($1,$2,$3,$4,$5,$6)`, [key, row.entryKey, row.account, row.beneficiaryId, row.currency, row.amountMinor]);
    }
    const amounts = new Map(request.plan.parts.filter(p => BigInt(p.sellerNetMinor)>0n).map(p => [p.partKey,p.sellerNetMinor]));
    if (BigInt(request.plan.affiliateMinor)>0n) amounts.set('affiliate-pending', request.plan.affiliateMinor);
    for (const [source, amount] of amounts) {
      const part = quote.parts.find(p => p.key===source);
      const beneficiary = part?.storeId ?? quote.affiliate?.id;
      const lotAmount = part?.sellerNetMinor ?? quote.affiliate?.commissionMinor;
      if (!beneficiary || lotAmount === undefined) throw new Error('Synthetic original refund allocation missing');
      const kind = part ? 'SELLER' : 'AFFILIATE';
      await tx.query(`INSERT INTO "EconomicBalanceAccount" ("id","kind","beneficiaryId","currency","provenance","minorExponent")
        VALUES ($1,$2,$3,'USD','TEST',2) ON CONFLICT ("kind","beneficiaryId","currency","provenance") DO NOTHING`, [`account-${kind}-${beneficiary}`,kind,beneficiary]);
      const account = (await tx.query<{ id: string }>(`SELECT "id" FROM "EconomicBalanceAccount" WHERE "kind"=$1 AND "beneficiaryId"=$2 AND "currency"='USD' AND "provenance"='TEST'`, [kind,beneficiary])).rows[0];
      await tx.query(`INSERT INTO "EconomicBalanceLot" ("accountId","captureId","sourceKey","amountMinor","eligibleAt")
        VALUES ($1,$2,$3,$4,now()) ON CONFLICT ("captureId","sourceKey") DO NOTHING`, [account.id,`capture${suffix}`,source,lotAmount]);
      const lot = (await tx.query<{ id: string; debt: string }>(`SELECT "id", (greatest(0,"paidMinor"::numeric+"debtRecoveredMinor"::numeric+"reversedMinor"::numeric+$3::numeric-"amountMinor"::numeric)
        - greatest(0,"paidMinor"::numeric+"debtRecoveredMinor"::numeric+"reversedMinor"::numeric-"amountMinor"::numeric))::text AS debt
        FROM "EconomicBalanceLot" WHERE "captureId"=$1 AND "sourceKey"=$2`, [`capture${suffix}`,source,amount])).rows[0];
      const debt = forgedDebt ? BigInt(lot.debt)+1n : BigInt(lot.debt);
      await tx.query(`INSERT INTO "EconomicRefundLotReversal" ("refundId","lotId","amountMinor","availableDebitMinor","debtMinor")
        VALUES ($1,$2,$3,$4,$5)`, [key,lot.id,amount,(BigInt(amount)-debt).toString(),debt.toString()]);
      await tx.query(`UPDATE "EconomicBalanceLot" SET "reversedMinor"="reversedMinor"+$2 WHERE "id"=$1`, [lot.id,amount]);
      if (debt>0n) await tx.query(`UPDATE "EconomicBalanceAccount" SET "debtMinor"="debtMinor"+$2 WHERE "id"=$1`, [account.id,debt.toString()]);
    }
  }

  it('stores immutable refund intent without changing captured money or paid evidence', async () => {
    await balanceFixture();
    await db.transaction(tx => refundIntent(tx, `refund${suffix}`));
    assert.equal((await db.query(`SELECT * FROM "EconomicRefundRequest" WHERE "id"=$1`, [`refund${suffix}`])).rows.length, 1);
    await assert.rejects(db.query(`UPDATE "EconomicRefundRequest" SET "reason"='changed' WHERE "id"=$1`, [`refund${suffix}`]), /immutable/i);
    await assert.rejects(db.query(`DELETE FROM "EconomicRefundRequest" WHERE "id"=$1`, [`refund${suffix}`]), /immutable/i);
    assert.equal((await db.query<{ amount: string }>(`SELECT "amountMinor"::text AS amount FROM "EconomicCapture" WHERE "id"=$1`, [`capture${suffix}`])).rows[0].amount, '100');
  });

  it('rejects a second unresolved refund and rolls back its operation', async () => {
    await balanceFixture();
    await db.transaction(tx => refundIntent(tx, `refund${suffix}`));
    await assert.rejects(db.transaction(tx => refundIntent(tx, `second${suffix}`)), /Refund exceeds|previous refund/);
    assert.equal((await db.query(`SELECT * FROM "EconomicOperation" WHERE "id"=$1`, [`second${suffix}`])).rows.length, 0);
  });

  it('rejects foreign shop, invented beneficiary amount, excess units and modified quote hash', async () => {
    await balanceFixture();
    for (const field of ['storeId', 'sellerNetMinor', 'quantity', 'quoteHash']) {
      await assert.rejects(db.transaction(tx => refundIntent(tx, `${field}${suffix}`, plan => {
        if (field === 'quoteHash') plan.quoteHash = '0'.repeat(64);
        else if (field === 'quantity') plan.parts[0].quantity = 2;
        else if (field === 'storeId') plan.parts[0].storeId = 'foreign';
        else plan.parts[0].sellerNetMinor = '101';
        return plan;
      })), /Refund/);
    }
  });

  it('rejects a repeated quantity after the first refund has succeeded', async () => {
    await balanceFixture();
    const key = `refund${suffix}`;
    await db.transaction(tx => refundIntent(tx, key));
    await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='refund-token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`, [key]);
    await db.transaction(tx => refundSettlement(tx, key));
    await assert.rejects(db.transaction(tx => refundIntent(tx, `repeat${suffix}`)), /Refund history|Refund exceeds/);
  });
  it('preserves individual fee codes, rule snapshots and amounts instead of checking only the total', async () => {
    suffix += 'fees';
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [{ id: `line${suffix}`, productId: 'product', variantId: null,
        quantity: 1, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
        customerShippingMinor: '0', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [
          { code: 'TRANSACTION_FEE', amountMinor: '7', ruleReference: 'original-rule' },
          { code: 'VAT', amountMinor: '3', ruleReference: 'original-tax-rule' },
        ] }], tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null }));
    await dispatch(); await db.transaction(tx => book(tx));
    for (const attack of ['code', 'rule', 'amount', 'missing', 'offsetting']) {
      await assert.rejects(db.transaction(tx => refundIntent(tx, `${attack}${suffix}`, plan => {
        const fees = plan.parts[0].fees;
        if (attack === 'code') fees[0].code = 'INVENTED';
        if (attack === 'rule') fees[0].ruleReference = 'current-rule';
        if (attack === 'amount') fees[0].amountMinor = '8';
        if (attack === 'missing') fees.pop();
        if (attack === 'offsetting') { fees[0].amountMinor = '6'; fees[1].amountMinor = '4'; }
        return plan;
      })), /Refund fee/);
    }
    await assert.doesNotReject(db.transaction(tx => refundIntent(tx, `valid${suffix}`)));
  });

  async function roundingFixture() {
    suffix += 'rounding';
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [{ id: `line${suffix}`, productId: 'product', variantId: null,
        quantity: 3, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
        customerShippingMinor: '0', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [
          { code: 'TRANSACTION_FEE', amountMinor: '1', ruleReference: 'original-rule' },
          { code: 'VAT', amountMinor: '1', ruleReference: 'original-tax-rule' },
        ] }], tax: { amountMinor: '0', ruleReference: 'synthetic' },
      affiliate: { id: 'original-affiliate', commissionMinor: '2', rate: '0.01', lockDays: 7, ruleReference: 'original-affiliate-rule' } }));
    await dispatch(); await db.transaction(tx => book(tx));
  }

  it('persists signed rounding plans for successive quantities and compensating journals without rewriting captured money', async () => {
    await roundingFixture();
    const originalEntries = (await db.query(`SELECT * FROM "EconomicJournalEntry" WHERE "captureId"=$1 ORDER BY "entryKey"`, [`capture${suffix}`])).rows;
    const parts: ReturnType<typeof planQuantityRefund>['parts'] = [];
    const adjustments: string[] = [];
    for (let quantity = 0; quantity < 3; quantity++) {
      const key = `refund-${quantity}${suffix}`;
      await db.transaction(tx => refundIntent(tx, key, plan => plan, new Map([[quote.parts[0].key, quantity]])));
      const stored = (await db.query<{ plan: ReturnType<typeof planQuantityRefund>; journal: RefundJournalRow[]; rounding: string }>(
        `SELECT "plan", "plannedJournal" AS journal, "platformRoundingMinor"::text AS rounding FROM "EconomicRefundRequest" WHERE "id"=$1`, [key])).rows[0];
      adjustments.push(stored.rounding); parts.push(...stored.plan.parts);
      assert.equal(stored.journal.reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n), 0n);
      // Synthetic proof fixture only, NOT provider sandbox verification.
      await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='fixture-token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`, [key]);
      await db.transaction(tx => refundSettlement(tx, key));
    }
    assert.deepEqual(adjustments, ['1', '1', '-2']);
    for (const field of ['customerMinor', 'sellerNetMinor', 'sellerFeeMinor', 'platformFundingMinor'] as const) {
      assert.equal(parts.reduce((sum, part) => sum + BigInt(part[field]), 0n), BigInt(quote.parts[0][field]));
    }
    assert.equal(parts.reduce((sum, part) => sum + BigInt(part.affiliateMinor), 0n), 2n);
    for (const fee of quote.parts[0].fees) {
      assert.equal(parts.reduce((sum, part) => {
        const originalFee = part.fees.find(row => row.code === fee.code);
        assert.ok(originalFee);
        return sum + BigInt(originalFee.amountMinor);
      }, 0n), BigInt(fee.amountMinor));
    }
    assert.deepEqual((await db.query(`SELECT * FROM "EconomicJournalEntry" WHERE "captureId"=$1 ORDER BY "entryKey"`, [`capture${suffix}`])).rows, originalEntries);
    assert.equal((await db.query<{ amount: string }>(`SELECT "amountMinor"::text AS amount FROM "EconomicCapture" WHERE "id"=$1`, [`capture${suffix}`])).rows[0].amount, '300');
    await assert.rejects(db.query(`UPDATE "EconomicRefundRequest" SET "platformRoundingMinor"=0 WHERE "id"=$1`, [`refund-0${suffix}`]), /immutable/);
    await assert.rejects(db.query(`UPDATE "EconomicRefundRequest" SET "plannedJournal"='[]' WHERE "id"=$1`, [`refund-0${suffix}`]), /immutable/);
  });

  it('rolls back invented rounding, policies and affiliate amounts at the database boundary', async () => {
    await roundingFixture();
    for (const attack of ['total', 'component', 'offsetting', 'policy', 'negative-zero', 'numeric-json', 'affiliate-part', 'affiliate-total']) {
      const key = `${attack}${suffix}`;
      await assert.rejects(db.transaction(tx => refundIntent(tx, key, plan => {
        if (attack === 'total') plan.platformRoundingMinor = '2';
        if (attack === 'component') plan.parts[0].rounding.platformMinor = '2';
        if (attack === 'offsetting') { plan.parts[0].rounding.fundingMinor = '1'; plan.parts[0].rounding.beneficiaryMinor = '0'; }
        if (attack === 'policy') Object.assign(plan, { roundingPolicy: 'invented-policy' });
        if (attack === 'negative-zero') plan.parts[0].rounding.feeMinor = '-0';
        if (attack === 'numeric-json') Object.assign(plan.parts[0].rounding, { platformMinor: 1 });
        if (attack === 'affiliate-part') plan.parts[0].affiliateMinor = '1';
        if (attack === 'affiliate-total') plan.affiliateMinor = '1';
        return plan;
      })), /Refund/);
      assert.equal((await db.query(`SELECT "id" FROM "EconomicOperation" WHERE "id"=$1`, [key])).rows.length, 0);
    }
    await assert.doesNotReject(db.transaction(tx => refundIntent(tx, `valid${suffix}`)));
  });

  it('rejects balanced but misclassified planned journals and foreign refund beneficiaries', async () => {
    await roundingFixture();
    for (const attack of ['rounding-account', 'seller', 'extra-offset']) {
      const key = `${attack}${suffix}`;
      await assert.rejects(db.transaction(tx => refundIntent(tx, key, plan => plan, new Map(), rows => {
        if (attack === 'rounding-account') return rows.map(row => row.account === 'PLATFORM_ROUNDING' ? { ...row, account: 'PLATFORM_FEES' } : row);
        if (attack === 'seller') return rows.map(row => row.account === 'SELLER_PAYABLE' ? { ...row, beneficiaryId: 'foreign-store' } : row);
        return [...rows, { entryKey: 'fake-debit', account: 'PLATFORM_ROUNDING', beneficiaryId: null, currency: 'USD', amountMinor: '1' },
          { entryKey: 'fake-credit', account: 'PLATFORM_ROUNDING', beneficiaryId: null, currency: 'USD', amountMinor: '-1' }];
      })), /Refund planned journal/);
      assert.equal((await db.query(`SELECT "id" FROM "EconomicOperation" WHERE "id"=$1`, [key])).rows.length, 0);
    }
    // The second unit has a nonzero affiliate reversal; it must retain its original beneficiary.
    const first = `first${suffix}`;
    await db.transaction(tx => refundIntent(tx, first));
    await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='fixture-token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`, [first]);
    await db.transaction(tx => refundSettlement(tx, first));
    await assert.rejects(db.transaction(tx => refundIntent(tx, `foreign-affiliate${suffix}`, plan => plan,
      new Map([[quote.parts[0].key, 1]]), rows => rows.map(row => row.account === 'AFFILIATE_PENDING' ? { ...row, beneficiaryId: 'foreign-affiliate' } : row))), /Refund planned journal/);
  });

  it('verifies original multi-shop affiliate residual ownership instead of trusting an unchanged commission total', async () => {
    suffix += 'affiliate-tie';
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      // Reverse input order deliberately: the immutable part key, not input order, wins the tie.
      stores: ['b', 'a'].map(store => ({ storeId: `store-${store}`, storeOrderId: `shop-${store}${suffix}`, lines: [
        { id: `line-${store}${suffix}`, productId: 'product', variantId: null, quantity: 1,
          unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
        customerShippingMinor: '0', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] })),
      tax: { amountMinor: '0', ruleReference: 'synthetic' },
      affiliate: { id: 'original-affiliate', commissionMinor: '1', rate: '0.01', lockDays: 7, ruleReference: 'original-rule' } }));
    await dispatch(); await db.transaction(tx => book(tx));
    const selection = quote.parts.map(part => ({ partKey: part.key, quantity: 1 }));
    await assert.rejects(db.transaction(tx => refundIntent(tx, `wrong-split${suffix}`, plan => {
      plan.parts.reverse().forEach((part, index) => { part.affiliateMinor = index === 0 ? '1' : '0'; });
      return plan;
    }, new Map(), rows => rows, selection)), /Refund affiliate/);
    assert.equal((await db.query(`SELECT "id" FROM "EconomicOperation" WHERE "id"=$1`, [`wrong-split${suffix}`])).rows.length, 0);
    await assert.doesNotReject(db.transaction(tx => refundIntent(tx, `valid${suffix}`, plan => plan, new Map(), rows => rows, selection)));
    const stored = (await db.query<{ plan: ReturnType<typeof planQuantityRefund> }>(`SELECT "plan" FROM "EconomicRefundRequest" WHERE "id"=$1`, [`valid${suffix}`])).rows[0].plan;
    assert.deepEqual(stored.parts.map(part => [part.storeId, part.affiliateMinor]), [['store-a', '1'], ['store-b', '0']]);
  });

  it('persists quantity refund and planned journal amounts beyond Number precision without loss', async () => {
    suffix += 'large-refund';
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [
        { id: `line${suffix}`, productId: 'product', variantId: null, quantity: 3,
          unitPriceMinor: '9007199254740993', sellerDiscountMinor: '0', platformDiscountMinor: '1' }],
        customerShippingMinor: '0', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] }],
      tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null }));
    await dispatch(); await db.transaction(tx => book(tx));
    const key = `refund${suffix}`;
    await db.transaction(tx => refundIntent(tx, key));
    const stored = (await db.query<{ plan: ReturnType<typeof planQuantityRefund>; journal: RefundJournalRow[]; rounding: string }>(
      `SELECT "plan", "plannedJournal" AS journal, "platformRoundingMinor"::text AS rounding FROM "EconomicRefundRequest" WHERE "id"=$1`, [key])).rows[0];
    assert.equal(stored.plan.customerMinor, '9007199254740992');
    assert.equal(stored.plan.parts[0].sellerNetMinor, '9007199254740993');
    assert.equal(stored.rounding, '-1');
    const sellerEntry = stored.journal.find(row => row.account === 'SELLER_PAYABLE');
    assert.ok(sellerEntry);
    assert.equal(sellerEntry.amountMinor, '9007199254740993');
    assert.equal(stored.journal.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n), 0n);
  });

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

  it('requires settlement proof, exact compensating journal and immutable provider reference', async () => {
    await balanceFixture();
    const key = `refund${suffix}`;
    await db.transaction(tx => refundIntent(tx,key));
    await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`,[key]);
    await assert.rejects(db.query(`UPDATE "EconomicOperation" SET "state"='SUCCEEDED',"providerReference"='re_fake',"completedAt"=now() WHERE "id"=$1`,[key]),/immutable settlement/);
    await assert.rejects(db.transaction(tx => refundSettlement(tx,key,true)),/journal mismatch/);
    await db.query(`UPDATE "EconomicOperation" SET "providerReference"=$2 WHERE "id"=$1`,[key,`re_${key}`]);
    await assert.rejects(db.query(`UPDATE "EconomicOperation" SET "providerReference"='re_foreign' WHERE "id"=$1`,[key]),/lookup identity immutable/);
    await db.transaction(tx => refundSettlement(tx,key));
    await assert.rejects(db.query(`DELETE FROM "EconomicRefund" WHERE "id"=$1`,[key]),/immutable/);
    await assert.rejects(db.query(`UPDATE "EconomicRefundJournalEntry" SET "amountMinor"=-1 WHERE "refundId"=$1`,[key]),/immutable/);
  });

  it('persists refund debt after a paid payout and recovers it from new eligible funds exactly once', async () => {
    await balanceFixture();
    const paidKey=`paid${suffix}`, key=`refund${suffix}`;
    await db.transaction(tx => reserve(tx,paidKey,60));
    await db.transaction(tx => settle(tx,paidKey,60,'TEST',`debt-transfer${suffix}`));
    await db.transaction(tx => refundIntent(tx,key));
    await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`,[key]);
    await assert.rejects(db.transaction(tx => refundSettlement(tx,key,false,true)),/original liability/);
    await db.transaction(tx => refundSettlement(tx,key));
    const lot=(await db.query<{paid:string;reversed:string}>(`SELECT "paidMinor"::text AS paid,"reversedMinor"::text AS reversed FROM "EconomicBalanceLot" WHERE "id"=$1`,[`lot${suffix}`])).rows[0];
    assert.deepEqual(lot,{paid:'60',reversed:'100'});
    assert.equal((await db.query<{debt:string}>(`SELECT "debtMinor"::text AS debt FROM "EconomicBalanceAccount" WHERE "id"='balance-store'`)).rows[0].debt,'60');
    await assert.rejects(db.query(`UPDATE "EconomicBalanceAccount" SET "debtMinor"=0 WHERE "id"='balance-store'`),/do not conserve/);
    suffix += 'recovery';
    await seedQuote(buildEconomicQuote({ orderId:`order${suffix}`,currency:'USD',minorExponent:2,
      stores:[{storeId:'store',storeOrderId:`shop${suffix}`,lines:[{id:`line${suffix}`,productId:'product',variantId:null,quantity:1,unitPriceMinor:'100',sellerDiscountMinor:'0',platformDiscountMinor:'0'}],customerShippingMinor:'0',expectedShippingSubsidyMinor:'0',giftWrapMinor:'0',fees:[]}],tax:{amountMinor:'0',ruleReference:'synthetic'},affiliate:null }));
    await balanceFixture();
    const recovery = async (tx:Transaction, amount:number) => {
      await tx.query(`INSERT INTO "EconomicDebtRecovery" ("lotId","amountMinor","recoveredBy") VALUES ($1,$2,'synthetic-operator')`,[`lot${suffix}`,amount]);
      await tx.query(`UPDATE "EconomicBalanceLot" SET "debtRecoveredMinor"="debtRecoveredMinor"+$2 WHERE "id"=$1`,[`lot${suffix}`,amount]);
      await tx.query(`UPDATE "EconomicBalanceAccount" SET "debtMinor"="debtMinor"-$1 WHERE "id"='balance-store'`,[amount]);
    };
    await db.query(`UPDATE "Order" SET "status"='DISPUTED' WHERE "id"=$1`,[`order${suffix}`]);
    await assert.rejects(db.transaction(tx => recovery(tx,60)),/eligible original funds/);
    await db.query(`UPDATE "Order" SET "status"='PENDING_PAYMENT' WHERE "id"=$1`,[`order${suffix}`]);
    await assert.rejects(db.transaction(tx => recovery(tx,60)),/eligible original funds/);
    await db.query(`UPDATE "Order" SET "status"='CONFIRMED' WHERE "id"=$1`,[`order${suffix}`]);
    await db.transaction(tx => recovery(tx,60));
    await assert.rejects(db.transaction(tx => recovery(tx,60)),/exceeds eligible funds/);
    await assert.rejects(db.transaction(tx => reserve(tx,`over${suffix}`,41)),/check constraint/);
    await db.transaction(tx => reserve(tx,`remaining${suffix}`,40));
    await assert.rejects(db.query(`DELETE FROM "EconomicDebtRecovery" WHERE "lotId"=$1`,[`lot${suffix}`]),/immutable/);
    assert.equal((await db.query<{debt:string}>(`SELECT "debtMinor"::text AS debt FROM "EconomicBalanceAccount" WHERE "id"='balance-store'`)).rows[0].debt,'0');
  });

  it('blocks refund settlement while a payout reservation exists and rolls back all refund effects', async () => {
    await balanceFixture();
    const key=`refund${suffix}`;
    await db.transaction(tx => refundIntent(tx,key));
    await db.transaction(tx => reserve(tx,`reserved${suffix}`,1));
    await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`,[key]);
    await assert.rejects(db.transaction(tx => refundSettlement(tx,key)),/reserved refund lot/);
    assert.equal((await db.query(`SELECT * FROM "EconomicRefund" WHERE "id"=$1`,[key])).rows.length,0);
    assert.equal((await db.query<{state:string}>(`SELECT "state" FROM "EconomicOperation" WHERE "id"=$1`,[key])).rows[0].state,'DISPATCHED');
  });

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

  it('independently verifies shipping cancellation/handoff, full original quantities and eligibility before accepting the original journal', async () => {
    suffix = String(++serial);
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [{ id: `line${suffix}`, productId: 'product', variantId: null,
        quantity: 2, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
        customerShippingMinor: '50', expectedShippingSubsidyMinor: '500', giftWrapMinor: '20', fees: [] }],
      tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null }));
    await dispatch(); await db.transaction(tx => book(tx));
    const key = `shipping-refund${suffix}`, selection = [{ partKey: `item:line${suffix}`, quantity: 2 }, { partKey: `shipping:shop${suffix}`, quantity: 1 }];
    const proof: ShippingRefundEligibility = { policy: SHIPPING_REFUND_POLICY, storeOrderIds: [`shop${suffix}`], previousItemQuantities: { [`item:line${suffix}`]: 0 } };
    const intent = (mutate = (plan: ReturnType<typeof planQuantityRefund>) => plan, id = key) =>
      db.transaction(tx => refundIntent(tx, id, mutate, new Map(), rows => rows, selection, false, proof));
    await assert.rejects(intent(), /no handoff/);
    await db.query(`UPDATE "StoreOrder" SET "status"='CANCELLED' WHERE "id"=$1`, [`shop${suffix}`]);
    await db.query(`INSERT INTO "StoreOrderFulfillment" ("storeOrderId") VALUES ($1)`, [`shop${suffix}`]);
    await assert.rejects(intent(), /no handoff/);
    await db.query(`DELETE FROM "StoreOrderFulfillment" WHERE "storeOrderId"=$1`, [`shop${suffix}`]);
    await db.query(`INSERT INTO "OrderStatusHistory" ("orderId","status") VALUES ($1,'SHIPPED')`, [`order${suffix}`]);
    await assert.rejects(intent(), /no handoff/);
    await db.query(`DELETE FROM "OrderStatusHistory" WHERE "orderId"=$1`, [`order${suffix}`]);
    await assert.rejects(intent(plan => { delete plan.shippingEligibility; return plan; }), /eligibility differs/);
    await assert.rejects(intent(plan => ({ ...plan, shippingEligibility: { ...proof, previousItemQuantities: { [`item:line${suffix}`]: 2 } } })), /eligibility differs/);
    await assert.rejects(intent(plan => ({ ...plan, parts: plan.parts.map(part => part.lineId ? { ...part, quantity: 1 } : part) })), /exceeds original|every original/);
    await intent();
    assert.equal((await db.query(`SELECT "id" FROM "EconomicRefundRequest" WHERE "id"=$1`, [key])).rows.length, 1);
    await assert.rejects(db.query(`UPDATE "EconomicRefundRequest" SET "plan"='{}' WHERE "id"=$1`, [key]), /immutable/);
  });

  it('keeps original external intents immutable, scopes provider proof and never resets ambiguous dispatch', async () => {
    await dispatch(); await db.transaction(tx => book(tx));
    const event = `external-event${suffix}`, effect = `external-effect${suffix}`;
    await db.query(`INSERT INTO "EconomicOutbox" ("id","contextId","eventKey","eventType","payload")
      VALUES ($1::text,$2,$1::text,'capture.verified.v1',$3)`, [event, `ctx${suffix}`, JSON.stringify({ operationId: `op${suffix}` })]);
    await db.query(`INSERT INTO "StoreFulfillmentConnection" ("id","storeId","provider","status","externalShopId") VALUES ($1,'store','PRINTIFY','ACTIVE','123')`, [`conn${suffix}`]);
    const insert = () => db.query(`INSERT INTO "EconomicExternalEffect" ("id","contextId","effectKey","kind","storeOrderId","connectionId","providerAccount","payload","payloadHash","requestedBy","reason")
      VALUES ($1,$2,$3,'POD_PRINTIFY',$4,$5,'123','{"version":"pod-v1"}',$3,'operator','Synthetic proof')`,
      [effect, `ctx${suffix}`, hash, `shop${suffix}`, `conn${suffix}`]);
    await assert.rejects(insert(), /original shop\/capture\/connection/);
    await db.query(`INSERT INTO "EconomicConsumerReceipt" ("eventId","consumer") VALUES ($1,'lifecycle.v1')`, [event]);
    await insert();
    await assert.rejects(db.query(`UPDATE "EconomicExternalEffect" SET "payload"='{}' WHERE "id"=$1`, [effect]), /immutable/);
    await assert.rejects(db.query(`UPDATE "EconomicExternalEffect" SET "state"='DISPATCHED',"dispatchToken"='token',"dispatchedAt"=now(),"providerReference"='forged' WHERE "id"=$1`, [effect]), /without claimed/);
    await db.query(`UPDATE "EconomicExternalEffect" SET "state"='DISPATCHED',"dispatchToken"='token',"dispatchedAt"=now() WHERE "id"=$1`, [effect]);
    await db.query(`UPDATE "EconomicExternalEffect" SET "state"='NEEDS_RECONCILIATION' WHERE "id"=$1`, [effect]);
    await assert.rejects(db.query(`UPDATE "EconomicExternalEffect" SET "state"='PREPARED',"dispatchToken"=NULL,"dispatchedAt"=NULL WHERE "id"=$1`, [effect]), /cannot reset/);
    await db.query(`UPDATE "EconomicExternalEffect" SET "state"='SUCCEEDED',"providerReference"='original',"evidenceHash"=$2,"completedAt"=now() WHERE "id"=$1`, [effect, hash]);
    await assert.rejects(db.query(`UPDATE "EconomicExternalEffect" SET "providerReference"='foreign' WHERE "id"=$1`, [effect]), /Terminal/);
    await assert.rejects(db.query(`DELETE FROM "EconomicExternalEffect" WHERE "id"=$1`, [effect]), /cannot be deleted/);
  });
  it('requires atomic original notification proof and preserves receipt after inbox deletion', async () => {
    const event = `notification-event${suffix}`, note = `notification${suffix}`;
    await db.query(`INSERT INTO "EconomicOutbox" ("id","contextId","eventKey","eventType","payload") VALUES ($1::text,$2,$1::text,'capture.verified.v1','{}')`, [event, `ctx${suffix}`]);
    const receipt = () => db.query(`INSERT INTO "EconomicNotificationReceipt" ("eventId","recipientId","notificationId") VALUES ($1,'buyer',$2)`, [event, note]);
    await assert.rejects(receipt(), /atomic original/);
    await db.query(`INSERT INTO "EconomicConsumerReceipt" ("eventId","consumer") VALUES ($1,'lifecycle.v1')`, [event]);
    await assert.rejects(receipt(), /atomic original/);
    await db.query(`INSERT INTO "Notification" ("id","userId","data") VALUES ($1,'buyer',$2)`, [note, JSON.stringify({ eventId: event, version: 'economic-v1' })]);
    await receipt(); await db.query(`DELETE FROM "Notification" WHERE "id"=$1`, [note]);
    assert.equal((await db.query(`SELECT * FROM "EconomicNotificationReceipt" WHERE "eventId"=$1`, [event])).rows.length, 1);
    await assert.rejects(db.query(`DELETE FROM "EconomicNotificationReceipt" WHERE "eventId"=$1`, [event]), /immutable/);
    await assert.rejects(db.query(`UPDATE "EconomicNotificationReceipt" SET "recipientId"='foreign' WHERE "eventId"=$1`, [event]), /immutable/);
  });
  it('independently rejects full-shop shipping refund with a prepared versioned POD intent', async () => {
    suffix = String(++serial);
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [{ id: `line${suffix}`, productId: 'product', variantId: null,
        quantity: 1, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
        customerShippingMinor: '50', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] }],
      tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null }));
    await dispatch(); await db.transaction(tx => book(tx));
    const event = `pod-event${suffix}`;
    await db.query(`INSERT INTO "EconomicOutbox" ("id","contextId","eventKey","eventType","payload") VALUES ($1::text,$2,$1::text,'capture.verified.v1',$3)`,
      [event, `ctx${suffix}`, JSON.stringify({ operationId: `op${suffix}` })]);
    await db.query(`INSERT INTO "EconomicConsumerReceipt" ("eventId","consumer") VALUES ($1,'lifecycle.v1')`, [event]);
    await db.query(`INSERT INTO "StoreFulfillmentConnection" ("id","storeId","provider","status","externalShopId") VALUES ($1,'store','PRINTIFY','ACTIVE','123')`, [`conn${suffix}`]);
    await db.query(`INSERT INTO "EconomicExternalEffect" ("contextId","effectKey","kind","storeOrderId","connectionId","providerAccount","payload","payloadHash","requestedBy","reason")
      VALUES ($1,$2,'POD_PRINTIFY',$3,$4,'123','{"version":"pod-v1"}',$2,'operator','Synthetic proof')`, [`ctx${suffix}`, hash, `shop${suffix}`, `conn${suffix}`]);
    await db.query(`UPDATE "StoreOrder" SET "status"='CANCELLED' WHERE "id"=$1`, [`shop${suffix}`]);
    const proof: ShippingRefundEligibility = { policy: SHIPPING_REFUND_POLICY, storeOrderIds: [`shop${suffix}`], previousItemQuantities: { [`item:line${suffix}`]: 0 } };
    await assert.rejects(db.transaction(tx => refundIntent(tx, `shipping-pod${suffix}`, plan => plan, new Map(), rows => rows,
      [{ partKey: `item:line${suffix}`, quantity: 1 }, { partKey: `shipping:shop${suffix}`, quantity: 1 }], false, proof)), /POD handoff/);
  });

  it('guards shipping exceptions after handoff, settles partial original money and prevents stale/excess cumulative approval', async () => {
    suffix = String(++serial);
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [{ id: `line${suffix}`, productId: 'product', variantId: null,
        quantity: 2, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
        customerShippingMinor: '503', expectedShippingSubsidyMinor: '500', giftWrapMinor: '0',
        fees: [{ code: 'TRANSACTION_FEE', amountMinor: '31', ruleReference: 'original' }, { code: 'VAT', amountMinor: '9', ruleReference: 'original' }] }],
      tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null }));
    await dispatch(); await db.transaction(tx => book(tx));
    await db.query(`UPDATE "StoreOrder" SET "status"='SHIPPED',"shippedAt"=now(),"trackingNumber"='original' WHERE "id"=$1`, [`shop${suffix}`]);
    await db.query(`INSERT INTO "StoreOrderFulfillment" ("storeOrderId") VALUES ($1)`, [`shop${suffix}`]);
    const make = (amountMinor: string, previous: string) => planShippingOverride(quote, {
      partKey: `shipping:shop${suffix}`, amountMinor, evidenceReference: 'case-1' }, previous, 'operator', 'Synthetic return');
    const insert = (key: string, plan: EconomicRefundPlan, mutate = (value: EconomicRefundPlan) => value) =>
      db.transaction(tx => refundIntent(tx, key, mutate, new Map(), rows => rows, [], false, undefined, plan));
    const original = make('201', '0');
    const originalApproval = original.shippingOverrideApproval;
    assert.ok(originalApproval);
    for (const field of ['approvedBy', 'reason', 'previousCustomerMinor', 'evidenceReference'] as const) {
      await assert.rejects(insert(`forged-${field}${suffix}`, original, plan => ({ ...plan, shippingOverrideApproval: {
        ...originalApproval, [field]: field === 'previousCustomerMinor' ? '1' : field === 'evidenceReference' ? ' ' : 'forged' } })), /Shipping exception differs/);
    }
    await assert.rejects(insert(`fees${suffix}`, original, plan => ({ ...plan, parts: plan.parts.map(part => ({ ...part,
      fees: part.fees.map((fee, index) => ({ ...fee, amountMinor: (BigInt(fee.amountMinor) + (index === 0 ? 1n : -1n)).toString() })) })) })), /fee component/);
    const first = `exception-first${suffix}`;
    await insert(first, original);
    await assert.rejects(insert(`unresolved${suffix}`, original), /previous refund/);
    await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`, [first]);
    await db.transaction(tx => refundSettlement(tx, first));
    await assert.rejects(insert(`stale${suffix}`, original), /Shipping exception differs/);
    const remaining = make('302', '201');
    const remainingApproval = remaining.shippingOverrideApproval;
    assert.ok(remainingApproval);
    await assert.rejects(insert(`excess${suffix}`, remaining, plan => ({ ...plan, customerMinor: '303',
      shippingOverrideApproval: { ...remainingApproval, amountMinor: '303' } })), /Shipping exception differs/);
    const second = `exception-second${suffix}`;
    await insert(second, remaining);
    await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`, [second]);
    await db.transaction(tx => refundSettlement(tx, second));
    assert.equal((await db.query<{ amount: string }>(`SELECT sum("amountMinor")::text AS amount FROM "EconomicRefund" WHERE "requestId" IN ($1,$2)`, [first, second])).rows[0].amount, '503');
    const shipping = quote.parts.find(p => p.kind === 'SHIPPING');
    assert.ok(shipping);
    assert.equal((await db.query<{ amount: string }>(`SELECT "reversedMinor"::text AS amount FROM "EconomicBalanceLot" WHERE "captureId"=$1 AND "sourceKey"=$2`, [`capture${suffix}`, `shipping:shop${suffix}`])).rows[0].amount, shipping.sellerNetMinor);
    await db.transaction(tx => refundIntent(tx, `merchandise${suffix}`)); // money-only shipping history must not consume item units
    await assert.rejects(db.query(`UPDATE "EconomicRefundRequest" SET "plan"='{}' WHERE "id"=$1`, [first]), /immutable/);
  });

  it('allows a separately approved shipping exception despite a versioned POD intent without weakening normal shipping rules', async () => {
    suffix = String(++serial);
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [{ id: `line${suffix}`, productId: 'product', variantId: null,
        quantity: 1, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
        customerShippingMinor: '50', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] }],
      tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null }));
    await dispatch(); await db.transaction(tx => book(tx));
    const event = `override-pod-event${suffix}`;
    await db.query(`INSERT INTO "EconomicOutbox" ("id","contextId","eventKey","eventType","payload") VALUES ($1::text,$2,$1::text,'capture.verified.v1',$3)`, [event, `ctx${suffix}`, JSON.stringify({ operationId: `op${suffix}` })]);
    await db.query(`INSERT INTO "EconomicConsumerReceipt" ("eventId","consumer") VALUES ($1,'lifecycle.v1')`, [event]);
    await db.query(`INSERT INTO "StoreFulfillmentConnection" ("id","storeId","provider","status","externalShopId") VALUES ($1,'store','PRINTIFY','ACTIVE','123')`, [`conn${suffix}`]);
    await db.query(`INSERT INTO "EconomicExternalEffect" ("contextId","effectKey","kind","storeOrderId","connectionId","providerAccount","payload","payloadHash","requestedBy","reason") VALUES ($1,$2,'POD_PRINTIFY',$3,$4,'123','{"version":"pod-v1"}',$2,'operator','Synthetic proof')`, [`ctx${suffix}`, hash, `shop${suffix}`, `conn${suffix}`]);
    const plan = planShippingOverride(quote, { partKey: `shipping:shop${suffix}`, amountMinor: '25', evidenceReference: 'case' }, '0', 'operator', 'Synthetic return');
    await db.transaction(tx => refundIntent(tx, `override-pod${suffix}`, value => value, new Map(), rows => rows, [], false, undefined, plan));
  });

  it('requires explicit gift wrap actor/reason approval and preserves original money, journal and refund history', async () => {
    suffix = String(++serial);
    await seedQuote(buildEconomicQuote({ orderId: `order${suffix}`, currency: 'USD', minorExponent: 2,
      stores: [{ storeId: 'store', storeOrderId: `shop${suffix}`, lines: [{ id: `line${suffix}`, productId: 'product', variantId: null,
        quantity: 1, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
        customerShippingMinor: '0', expectedShippingSubsidyMinor: '500', giftWrapMinor: '20', fees: [] }],
      tax: { amountMinor: '0', ruleReference: 'synthetic' },
      affiliate: { id: 'affiliate', commissionMinor: '10', rate: '0.1', lockDays: 14, ruleReference: 'original' } }));
    await dispatch(); await db.transaction(tx => book(tx));
    const key = `gift-refund${suffix}`, selection = [{ partKey: `gift-wrap:shop${suffix}`, quantity: 1 }];
    const intent = (mutate: (plan: ReturnType<typeof planQuantityRefund>) => ReturnType<typeof planQuantityRefund>, id = key) =>
      db.transaction(tx => refundIntent(tx, id, mutate, new Map(), rows => rows, selection, true));
    await assert.rejects(intent(plan => { delete plan.giftWrapApproval; return plan; }), /explicit matching actor/);
    await assert.rejects(intent(plan => ({ ...plan, giftWrapApproval: { policy: GIFT_WRAP_REFUND_POLICY, approvedBy: 'foreign', reason: 'Synthetic return' } })), /explicit matching actor/);
    await assert.rejects(intent(plan => ({ ...plan, giftWrapApproval: { policy: GIFT_WRAP_REFUND_POLICY, approvedBy: 'operator', reason: 'Other reason' } })), /explicit matching actor/);
    await assert.rejects(db.transaction(tx => refundIntent(tx, 'unselected-gift', plan => ({ ...plan,
      giftWrapApproval: { policy: GIFT_WRAP_REFUND_POLICY, approvedBy: 'operator', reason: 'Synthetic return' } }),
      new Map(), rows => rows, [{ partKey: `item:line${suffix}`, quantity: 1 }])), /no selected original allocation/);
    await intent(plan => plan);
    await db.query(`UPDATE "EconomicOperation" SET "state"='DISPATCHED',"dispatchToken"='token',"dispatchedAt"=now(),"reconcileAfter"=now() WHERE "id"=$1`, [key]);
    await db.transaction(tx => refundSettlement(tx, key));
    const request = (await db.query<{ plan: ReturnType<typeof planQuantityRefund> }>(`SELECT "plan" FROM "EconomicRefundRequest" WHERE "id"=$1`, [key])).rows[0];
    assert.equal(request.plan.customerMinor, '20'); assert.equal(request.plan.affiliateMinor, '0');
    assert.equal(request.plan.giftWrapApproval?.approvedBy, 'operator');
    await assert.rejects(intent(plan => plan, `${key}-repeat`), /history changed/);
    await assert.rejects(db.query(`UPDATE "EconomicRefundRequest" SET "reason"='Changed' WHERE "id"=$1`, [key]), /immutable/);
  });

  it('requires atomic original proof/receipt for immutable recovery and never resets DEAD', async () => {
    await dispatch(); await db.transaction(tx => book(tx));
    const id = `recovery-event${suffix}`;
    await db.query(`INSERT INTO "EconomicOutbox" ("id","contextId","eventKey","eventType","payload")
      VALUES ($1::text,$2,$1::text,'capture.verified.v1',$3)`, [id, `ctx${suffix}`, JSON.stringify({ operationId: `op${suffix}` })]);
    const audit = (tx: Transaction) => tx.query(`INSERT INTO "EconomicLifecycleRecovery" ("eventId","actorId","reason","applied")
      VALUES ($1,'operator','Original pool restored',true)`, [id]);
    await assert.rejects(db.transaction(audit), /terminal event/);
    await db.query(`UPDATE "EconomicOutbox" SET "state"='CLAIMED',"attempts"=1,"leaseToken"='lease',"leaseUntil"=now()+interval '30 seconds' WHERE "id"=$1`, [id]);
    await db.query(`UPDATE "EconomicOutbox" SET "state"='DEAD',"leaseToken"=NULL,"leaseUntil"=NULL WHERE "id"=$1`, [id]);
    await assert.rejects(db.transaction(audit), /atomic consumer receipt/);
    const recover = (fail: boolean) => db.transaction(async tx => {
      await tx.query(`INSERT INTO "EconomicConsumerReceipt" ("eventId","consumer") VALUES ($1,'lifecycle.v1')`, [id]);
      await tx.query(`INSERT INTO "SyntheticConsumerEffect" ("eventId","count") VALUES ($1,1)`, [id]);
      await audit(tx);
      if (fail) throw new Error('Synthetic recovery failure');
    });
    await assert.rejects(recover(true), /recovery failure/);
    assert.equal((await db.query(`SELECT * FROM "EconomicLifecycleRecovery" WHERE "eventId"=$1`, [id])).rows.length, 0);
    assert.equal((await db.query(`SELECT * FROM "EconomicConsumerReceipt" WHERE "eventId"=$1`, [id])).rows.length, 0);
    await recover(false);
    await assert.rejects(db.query(`UPDATE "EconomicOutbox" SET "state"='PENDING',"attempts"=0 WHERE "id"=$1`, [id]), /Terminal outbox/);
    await assert.rejects(db.query(`DELETE FROM "EconomicLifecycleRecovery" WHERE "eventId"=$1`, [id]), /immutable/);
    assert.deepEqual((await db.query(`SELECT "state","attempts" FROM "EconomicOutbox" WHERE "id"=$1`, [id])).rows[0], { state: 'DEAD', attempts: 1 });
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

  it('records immutable late-capture reacquisition without resetting the original reservation', async () => {
    await dispatch(); await db.transaction(tx => book(tx));
    await db.query(`INSERT INTO "EconomicInventoryReservation" ("id","contextId","productId","poolKey","target","quantity","lines","expiresAt")
      VALUES ($1,$2,'product','product:product','PRODUCT',1,'[]',now())`, [`late${suffix}`,`ctx${suffix}`]);
    await db.query(`UPDATE "EconomicInventoryReservation" SET "state"='EXPIRED',"releasedAt"=now() WHERE "id"=$1`, [`late${suffix}`]);
    await assert.rejects(db.query(`UPDATE "EconomicInventoryReservation" SET "state"='HELD',"releasedAt"=NULL WHERE "id"=$1`, [`late${suffix}`]), /cannot be reset/i);
    await assert.rejects(db.query(`INSERT INTO "EconomicInventoryReacquisition" ("reservationId","captureId","quantity") VALUES ($1,$2,2)`, [`late${suffix}`,`capture${suffix}`]), /original released pool/);
    await db.query(`INSERT INTO "EconomicInventoryReacquisition" ("id","reservationId","captureId","quantity") VALUES ($1,$2,$3,1)`, [`reacq${suffix}`,`late${suffix}`,`capture${suffix}`]);
    await assert.rejects(db.query(`INSERT INTO "EconomicInventoryReacquisition" ("reservationId","captureId","quantity") VALUES ($1,$2,1)`, [`late${suffix}`,`capture${suffix}`]), /unique constraint/);
    await assert.rejects(db.query(`UPDATE "EconomicInventoryReacquisition" SET "quantity"=2 WHERE "id"=$1`, [`reacq${suffix}`]), /immutable/);
    await assert.rejects(db.query(`DELETE FROM "EconomicInventoryReacquisition" WHERE "id"=$1`, [`reacq${suffix}`]), /immutable/);
    assert.equal((await db.query<{state:string}>(`SELECT "state" FROM "EconomicInventoryReservation" WHERE "id"=$1`, [`late${suffix}`])).rows[0].state,'EXPIRED');
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

  async function checkoutReceipt(tx: PGlite | Transaction, id: string, identity = '1'.repeat(64), amount = 1549, online = false) {
    await tx.query(`INSERT INTO "CheckoutRequest" ("identityHash","scopeHash","payloadHash","cartId","cartFingerprint","orderId","orderNumber","paymentRequired","initialStatus","totalMinor")
      VALUES ($1,$2,$2,'synthetic-cart',$2,$3,$4,$5,$6,$7)`, [identity,'a'.repeat(64),id,`EZH-${id}`,online,online ? 'PENDING_PAYMENT' : 'CONFIRMED',amount]);
  }
  it('persists immutable checkout responses and leaves request tombstones after non-financial deletion', async () => {
    const id = `manual${suffix}`;
    await db.query(`INSERT INTO "Order" ("id","orderNumber","total") VALUES ($1,$2,15.49)`, [id,`EZH-${id}`]);
    await checkoutReceipt(db,id);
    await assert.rejects(db.query(`UPDATE "CheckoutRequest" SET "totalMinor"=999 WHERE "orderId"=$1`,[id]), /immutable/);
    await assert.rejects(db.query(`DELETE FROM "CheckoutRequest" WHERE "orderId"=$1`,[id]), /immutable/);
    await db.query(`DELETE FROM "Order" WHERE "id"=$1`,[id]);
    assert.equal((await db.query(`SELECT "orderId" FROM "CheckoutRequest" WHERE "orderId"=$1`,[id])).rows.length,1);
    await assert.rejects(checkoutReceipt(db,id,'2'.repeat(64)), /no rows/);
  });
  it('rejects forged checkout totals and online flags against original orders', async () => {
    const id = `manual${suffix}`;
    await db.query(`INSERT INTO "Order" ("id","orderNumber","total") VALUES ($1,$2,15.49)`, [id,`EZH-${id}`]);
    await assert.rejects(checkoutReceipt(db,id,'3'.repeat(64),1550), /original order/);
    await assert.rejects(checkoutReceipt(db,id,'3'.repeat(64),1549,true), /original order/);
    await db.query(`UPDATE "Order" SET "orderNumber"=$2,"total"=15.49,"status"='PENDING_PAYMENT' WHERE "id"=$1`, [`order${suffix}`,`EZH-order${suffix}`]);
    await checkoutReceipt(db,`order${suffix}`,'3'.repeat(64),1549,true);
    assert.equal((await db.query(`SELECT "paymentRequired" FROM "CheckoutRequest" WHERE "orderId"=$1`,[`order${suffix}`])).rows[0]['paymentRequired'],true);
  });
  it('enforces checkout identity uniqueness and rolls back order creation when receipt insertion fails', async () => {
    const id = `manual${suffix}`;
    await db.query(`INSERT INTO "Order" ("id","orderNumber","total") VALUES ($1,$2,15.49)`, [id,`EZH-${id}`]);
    await checkoutReceipt(db,id,'4'.repeat(64));
    const duplicate = `rollback${suffix}`;
    await assert.rejects(db.transaction(async tx => {
      await tx.query(`INSERT INTO "Order" ("id","orderNumber","total") VALUES ($1,$2,15.49)`,[duplicate,`EZH-${duplicate}`]);
      await checkoutReceipt(tx,duplicate,'4'.repeat(64));
    }), /unique constraint/);
    assert.equal((await db.query(`SELECT "id" FROM "Order" WHERE "id"=$1`,[duplicate])).rows.length,0);
    await assert.rejects(checkoutReceipt(db,id,'5'.repeat(64)), /unique constraint/);
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
