import { resolve } from 'node:path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { SCENARIOS, runScenario, CaseEvidence } from './contention-cases';
const { assertRuntime, assertEnvironment, generateEnvironment, cleanChildEnvironment, assertDatabaseIdentity,
  SCENARIO_DATABASE, migrationManifest } = require('./guard.cjs');
const { sourceChecksums, assertFoundationEvidence } = require('./evidence.cjs');
const { readFileSync } = require('node:fs');

// The parent exclusively owns reports. Never print a driver/provider reply.
async function main() {
  assertRuntime();
  const runId = process.argv[2], foundationId = process.argv[3];
  if (process.argv.length !== 4 || !/^[a-f0-9]{24}$/.test(runId ?? '') || !/^[a-f0-9]{24}$/.test(foundationId ?? '')) throw new Error('M5_CONTENTION_IDENTITY');
  const root = resolve(__dirname, '../..');
  const env = Object.fromEntries(Object.keys(generateEnvironment()).map(key => [key, process.env[key] ?? '']));
  // Parent passes only the derived third database; recover the validated base
  // URL for shared guard functions, without accepting arbitrary URL parameters.
  const supplied = env['DATABASE_URL'];
  const base = new URL(supplied); base.pathname = '/ezihubb_m5_fresh'; env['DATABASE_URL'] = base.href;
  assertEnvironment(env);
  if (supplied !== cleanChildEnvironment(env, SCENARIO_DATABASE).DATABASE_URL) throw new Error('M5_DATABASE_IDENTITY');
  assertFoundationEvidence(JSON.parse(readFileSync(resolve(root, 'artifacts/m5', `${foundationId}.json`), 'utf8')),
    sourceChecksums(root), migrationManifest(root));
  const pools = [0, 1].map(() => new Pool({ connectionString: supplied, max: 1, connectionTimeoutMillis: 5000,
    options: '-c statement_timeout=60000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=60000' }));
  const clients = pools.map(pool => new PrismaClient({ adapter: new PrismaPg(pool), log: [] })) as [PrismaClient, PrismaClient];
  const cases: CaseEvidence[] = [];
  try {
    for (const pool of pools) await assertDatabaseIdentity(pool, env, SCENARIO_DATABASE);
    const marker = (await pools[0].query('SELECT payload FROM m5_guard.fixture_receipt WHERE name=$1', ['m5-scenarios-owner-v1'])).rows[0]?.payload;
    if (marker?.version !== 'm5-scenarios-owner-v1') throw new Error('M5_SCENARIO_OWNERSHIP');
    for (const name of SCENARIOS) {
      try { cases.push(await runScenario(name, clients, runId)); }
      catch {
        // Deliberately no raw exception/PII. Parent records the named failure.
        console.log(JSON.stringify({ version: 'm5.2-cases-v1', outcome: 'FAIL', runId, foundationId, failedCase: name }));
        return;
      }
    }
    console.log(JSON.stringify({ version: 'm5.2-cases-v1', runId, foundationId, outcome: 'PASS',
      database: SCENARIO_DATABASE, providerEvidence: 'SYNTHETIC_TEST_ONLY', fullStack: false, cases }));
  } finally {
    await Promise.allSettled(clients.map(client => client.$disconnect()));
    await Promise.allSettled(pools.map(pool => pool.end()));
  }
}
main().catch(() => { console.log(JSON.stringify({ outcome: 'BLOCKED', code: 'M5_CONTENTION_CASE_FAILED' })); process.exitCode = 1; });
