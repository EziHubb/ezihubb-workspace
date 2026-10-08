import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { consumeVerifiedEconomics } from '../../apps/api/src/modules/finances/economic-consumers';
import { claimEconomicEvent } from '../../apps/api/src/modules/finances/economic-durability';
import { executeExternalEffect } from '../../apps/api/src/modules/finances/economic-external-effect';
import { verifyAndBookEconomicCapture } from '../../apps/api/src/modules/finances/economic-capture';
import { captureReader } from './contention-fixtures';
import { PHASES, Phase } from './recovery-process';
const { generateEnvironment, assertEnvironment, cleanChildEnvironment, assertDatabaseIdentity, SCENARIO_DATABASE } = require('./guard.cjs');
const { runIdentity } = require('./recovery-support.cjs');

async function main() {
  const [runId, nonce, rawPhase, resourceId] = process.argv.slice(2);
  runIdentity(runId);
  if (process.argv.length !== 6 || !/^[a-f0-9]{48}$/.test(nonce ?? '') || !PHASES.includes(rawPhase as Phase)
    || !/^[A-Za-z0-9]{12}$/.test(resourceId ?? '') || !process.send) throw new Error('M5_RECOVERY_CHILD_IDENTITY');
  const phase = rawPhase as Phase;
  const send = process.send.bind(process);
  const env = Object.fromEntries(Object.keys(generateEnvironment()).map(key => [key, process.env[key] ?? '']));
  const supplied = env['DATABASE_URL'];
  const url = new URL(supplied); url.pathname = '/ezihubb_m5_fresh'; env['DATABASE_URL'] = url.href;
  assertEnvironment(env);
  if (supplied !== cleanChildEnvironment(env, SCENARIO_DATABASE).DATABASE_URL) throw new Error('M5_DATABASE_IDENTITY');
  const pool = new Pool({ connectionString: supplied, max: 1, connectionTimeoutMillis: 5000,
    options: '-c statement_timeout=60000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=60000' });
  const db = new PrismaClient({ adapter: new PrismaPg(pool), log: [] });
  // Parent death must abort a waiting transaction, never continue/commit it.
  process.once('disconnect', () => process.exit(1));
  const watchdog = setTimeout(() => process.exit(1), 55_000);
  try {
    await assertDatabaseIdentity(pool, env, SCENARIO_DATABASE);
    const backendPid = (await pool.query('SELECT pg_backend_pid()::int AS pid')).rows[0].pid;
    const pause = async () => {
      send({ kind: 'm5-recovery-barrier-v1', runId, nonce, phase, pid: process.pid, resourceId, backendPid });
      await new Promise<void>(() => { /* Only the owned parent kill can release this barrier. */ });
    };
    const beforeCommitClient = () => new Proxy(db, { get(target, key) {
      if (key === '$transaction') return <T>(work: (tx: Prisma.TransactionClient) => Promise<T>, options: object) =>
        target.$transaction(async tx => { const value = await work(tx); await pause(); return value; }, { ...options, timeout: 60_000 });
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    if (phase === 'capture-before-commit' || phase === 'capture-after-commit') {
      const operation = await db.economicOperation.findUniqueOrThrow({ where: { id: resourceId }, include: { context: { include: { order: true } } } });
      if (operation.context.order.note !== `M5.4 ${runId}` || operation.context.provenance !== 'TEST') throw new Error('M5_RECOVERY_RESOURCE_SCOPE');
      const payment = await db.payment.findUniqueOrThrow({ where: { orderId: operation.context.orderId } });
      const order = { operation, context: operation.context, order: operation.context.order, payment,
        quote: operation.context.quote as unknown as import('../../apps/api/src/modules/finances/economic-quote').EconomicQuote };
      await verifyAndBookEconomicCapture(phase === 'capture-before-commit' ? beforeCommitClient() : db, operation.id, captureReader(order));
      if (phase === 'capture-after-commit') await pause();
      throw new Error('M5_RECOVERY_MUST_BE_KILLED');
    }
    if (phase === 'external-created') {
      const effect = await db.economicExternalEffect.findUniqueOrThrow({ where: { id: resourceId }, include: { context: true } });
      if (effect.reason !== `M5.4 ${runId}` || effect.context.provenance !== 'TEST') throw new Error('M5_RECOVERY_RESOURCE_SCOPE');
      await executeExternalEffect(db, effect.id, 'TEST', { kind: effect.kind, providerAccount: effect.providerAccount, provenance: 'TEST',
        create: async () => {
          // A separate committed synthetic provider-side resource. NOT an actual provider.
          await pool.query('INSERT INTO m5_guard.fixture_receipt(name,payload) VALUES($1,$2::jsonb)',
            [`m5-recovery-external:${runId}`, JSON.stringify({ reference: `m54_${runId}`, payloadHash: effect.payloadHash })]);
          await pause(); return `m54_${runId}`;
        }, verify: async () => { throw new Error('M5_RECOVERY_MUST_BE_KILLED'); } }, async () => undefined);
      throw new Error('M5_RECOVERY_MUST_BE_KILLED');
    }
    const event = await db.economicOutbox.findUniqueOrThrow({ where: { id: resourceId }, include: { context: { include: { order: true } } } });
    if (event.context.provenance !== 'TEST' || event.context.order.note !== `M5.4 ${runId}`) throw new Error('M5_RECOVERY_RESOURCE_SCOPE');
    if (phase === 'lease-claimed') {
      // Narrow candidate selection to this owned synthetic event; actual CAS/lease logic remains unchanged.
      const scoped = new Proxy(db, { get(target, key) {
        if (key === 'economicOutbox') return new Proxy(target.economicOutbox, { get(model, method) {
          if (method === 'findFirst') return (input: Prisma.EconomicOutboxFindFirstArgs) => model.findFirst({
            ...input, where: { AND: [input.where ?? {}, { id: resourceId }] } });
          const value = Reflect.get(model, method); return typeof value === 'function' ? value.bind(model) : value;
        } });
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      const claimed = await claimEconomicEvent(scoped, new Date(), 'TEST');
      if (claimed?.id !== resourceId) throw new Error('M5_RECOVERY_LEASE');
      await pause();
    } else if (phase === 'before-commit') {
      // Pause inside the REAL transaction after all business effects, before commit.
      await consumeVerifiedEconomics(beforeCommitClient(), event, 'TEST');
    } else { await consumeVerifiedEconomics(db, event, 'TEST'); await pause(); }
  } finally { clearTimeout(watchdog); await db.$disconnect(); await pool.end(); }
}
main().catch(() => { process.exitCode = 1; });
