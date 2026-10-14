import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { economicTransaction, readEconomicBalance } from '../src/modules/finances/economic-balance';

const scope = { kind: 'SELLER' as const, beneficiaryId: 'synthetic-store', currency: 'USD', provenance: 'TEST' as const };

// Real generated client + real PG adapter, but SQL transport is replaced before
// connecting. This proves input validation/error mapping, NOT native contention.
function boundary() {
  const pool = new Pool({ host: '127.0.0.1', port: 1, user: 'synthetic', database: 'synthetic' });
  let queries = 0, fault: string | undefined;
  Object.defineProperty(pool, 'connect', { value: async () => { throw new Error('NETWORK_FORBIDDEN'); } });
  Object.defineProperty(pool, 'query', { value: async (query: { text: string }) => {
    assert.match(query.text, /^SELECT\b/i, 'only reads are allowed in the client boundary fixture');
    queries++;
    if (fault) throw Object.assign(new Error('synthetic database error'), { code: fault, severity: 'ERROR' });
    return { rows: [], fields: [], rowCount: 0, command: 'SELECT' };
  } });
  const client = new PrismaClient({ adapter: new PrismaPg(pool), log: [] });
  return { client, get queries() { return queries; }, failWith(code?: string) { fault = code; },
    async close() { await client.$disconnect(); await pool.end(); } };
}

test('projects a full account into a valid four-field Prisma compound selector', async () => {
  const h = boundary();
  try {
    const account = { id: 'synthetic-account', ...scope, minorExponent: 2, debtMinor: 0n,
      holdReason: null, createdAt: new Date(0), updatedAt: new Date(0) };
    // Control: this is the exact invalid shape previously used by reject.
    await assert.rejects(h.client.economicBalanceAccount.findUnique({
      where: { kind_beneficiaryId_currency_provenance: account },
    }), Prisma.PrismaClientValidationError);
    assert.equal(h.queries, 0);
    const balance = await readEconomicBalance(h.client, account);
    assert.equal(balance.account, null);
    assert.equal(h.queries, 1, 'projected selector reaches the read transport');
  } finally { await h.close(); }
});

for (const code of ['40001', '40P01']) test(`real adapter maps ${code} raw lock conflicts and retries the whole DB callback`, async () => {
  const h = boundary();
  try {
    h.failWith(code);
    await assert.rejects(h.client.economicBalanceAccount.findUnique({
      where: { kind_beneficiaryId_currency_provenance: scope },
    }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034');
    await assert.rejects(h.client.$queryRaw`SELECT "id" FROM "EconomicBalanceAccount" FOR UPDATE`,
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010');
    let attempts = 0;
    const database = { $transaction: async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      if (++attempts === 2) h.failWith();
      return work(h.client);
    } };
    await economicTransaction(database as never, tx => tx.$queryRaw`SELECT "id" FROM "EconomicBalanceAccount" FOR UPDATE`);
    assert.equal(attempts, 2);
  } finally { await h.close(); }
});

test('real adapter non-conflict raw SQL errors are not retried', async () => {
  const h = boundary();
  try {
    h.failWith('23505');
    let attempts = 0;
    const database = { $transaction: async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      attempts++; return work(h.client);
    } };
    await assert.rejects(economicTransaction(database as never,
      tx => tx.$queryRaw`SELECT "id" FROM "EconomicBalanceAccount" FOR UPDATE`),
    (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010');
    assert.equal(attempts, 1);
  } finally { await h.close(); }
});
