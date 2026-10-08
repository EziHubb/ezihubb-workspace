import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '@prisma/client';

/** Both transactions must be open on distinct PostgreSQL backends BEFORE work.
 * Only first attempts rendezvous; production SERIALIZABLE retries remain intact.
 * No mock mutex or serialized transaction scheduler is used. */
export function transactionRendezvous(clients: [PrismaClient, PrismaClient]) {
  let arrivals = 0;
  const pids: number[] = [];
  let release!: () => void;
  let reject!: (error: Error) => void;
  const gate = new Promise<void>((yes, no) => { release = yes; reject = no; });
  const timer = setTimeout(() => reject(new Error('M5_RENDEZVOUS_TIMEOUT')), 5000);
  gate.catch(() => undefined); // Prevent an unhandled rejection before first arrival.
  const databases = clients.map(client => {
    let first = true;
    return new Proxy(client, { get(target, key) {
      if (key !== '$transaction') {
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return <T>(work: (tx: Prisma.TransactionClient) => Promise<T>, options?: Parameters<PrismaClient['$transaction']>[1]) =>
        target.$transaction(async tx => {
          if (first) {
            first = false;
            const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
            pids.push(rows[0].pid);
            if (++arrivals === 2) {
              clearTimeout(timer);
              if (new Set(pids).size !== 2) reject(new Error('M5_INDEPENDENT_SESSIONS_REQUIRED'));
              else release();
            }
            await gate;
          }
          return work(tx);
        }, { ...options, maxWait: 10_000, timeout: 30_000 });
    } });
  }) as [PrismaClient, PrismaClient];
  return { databases, pids, close: () => clearTimeout(timer) };
}
export async function race<T>(clients: [PrismaClient, PrismaClient], work: (db: PrismaClient, index: number) => Promise<T>) {
  const rendezvous = transactionRendezvous(clients);
  try {
    const results = await Promise.allSettled(rendezvous.databases.map(work));
    assert.equal(new Set(rendezvous.pids).size, 2, 'independent native PG sessions must participate');
    return { results, backendPids: rendezvous.pids };
  } finally { rendezvous.close(); }
}
export function expectSuccesses(results: PromiseSettledResult<unknown>[], count: number, expectedFailure?: RegExp) {
  assert.equal(results.filter(result => result.status === 'fulfilled').length, count);
  for (const result of results) if (result.status === 'rejected') {
    // Serialization conflicts can be surfaced by non-retrying production paths.
    const error = result.reason as { code?: string; message?: string };
    assert(error.code === 'P2034' || (expectedFailure && expectedFailure.test(error.message ?? '')),
      'unexpected database/business failure must not count as a valid race loser');
  }
}
