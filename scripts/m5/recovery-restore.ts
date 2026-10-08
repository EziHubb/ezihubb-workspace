import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Pool, PoolClient } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { consumeVerifiedEconomics } from '../../apps/api/src/modules/finances/economic-consumers';
import { Catalog, createProduct } from './contention-fixtures';
const { ROOT, MAX_BACKUP_BYTES, command, inspectOwned, restoreDatabase, snapshotHash, assertSnapshotEqual, measureRestore, archiveCreatesPublicSchema } = require('./recovery-support.cjs');
const { assertEnvironment, assertDatabaseIdentity, SCENARIO_DATABASE, cleanChildEnvironment } = require('./guard.cjs');

export async function databaseSnapshot(client: Pool | PoolClient) {
  const names: string[] = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename COLLATE \"C\"")).rows.map(row => row.tablename);
  const tables: Array<{ name: string; count: number; sha256: string }> = [];
  for (const name of names) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('M5_RESTORE_RELATION');
    const count = (await client.query(`SELECT count(*)::int AS count FROM public."${name}"`)).rows[0].count;
    if (count > 100_000) throw new Error('M5_RESTORE_SIZE_LIMIT');
    const rows: string[] = (await client.query(`SELECT row_to_json(t)::text AS row FROM public."${name}" t`)).rows.map(row => row.row);
    rows.sort();
    tables.push({ name, count, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') });
  }
  const schema = (await client.query(`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name COLLATE "C",ordinal_position`)).rows;
  const constraints = (await client.query(`SELECT t.relname,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' ORDER BY t.relname COLLATE "C",c.conname COLLATE "C"`)).rows;
  const triggers = (await client.query(`SELECT t.relname,g.tgname,pg_get_triggerdef(g.oid) AS definition FROM pg_trigger g
    JOIN pg_class t ON t.oid=g.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND NOT g.tgisinternal ORDER BY t.relname COLLATE "C",g.tgname COLLATE "C"`)).rows;
  const functions = (await client.query(`SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
    ORDER BY p.proname COLLATE "C",pg_get_function_identity_arguments(p.oid) COLLATE "C"`)).rows;
  const indexes = (await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
    ORDER BY tablename COLLATE "C",indexname COLLATE "C"`)).rows;
  const enums = (await client.query(`SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
    JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname COLLATE "C",e.enumsortorder`)).rows;
  const views = (await client.query(`SELECT viewname,definition FROM pg_views WHERE schemaname='public' ORDER BY viewname COLLATE "C"`)).rows;
  const sequenceNames = (await client.query(`SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename COLLATE "C"`)).rows;
  const sequences = [];
  for (const { sequencename } of sequenceNames) {
    if (!/^[A-Za-z0-9_]+$/.test(sequencename)) throw new Error('M5_RESTORE_RELATION');
    sequences.push({ name: sequencename, state: (await client.query(`SELECT last_value::text,is_called FROM public."${sequencename}"`)).rows[0] });
  }
  return { tables, schemaHash: snapshotHash({ schema, constraints, triggers, functions, indexes, enums, views }), sequences };
}
export async function backupAndRestore(input: { env: Record<string, string>; context: string; postgresId: string;
  runId: string; sourcePool: Pool; sourceDb: PrismaClient; catalog: Catalog; replayEventId: string }) {
  const { env, context, postgresId, runId, sourcePool, sourceDb, catalog, replayEventId } = input;
  assertEnvironment(env); await assertDatabaseIdentity(sourcePool, env, SCENARIO_DATABASE);
  inspectOwned(context, env, postgresId, 'postgres');
  const target = restoreDatabase(runId);
  const folder = resolve(ROOT, 'tmp/m5', `recovery-${runId}`), file = resolve(folder, 'snapshot.dump');
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const session = await sourcePool.connect();
  let snapshot!: Awaited<ReturnType<typeof databaseSnapshot>>, snapshotAt!: string;
  let backup!: Buffer;
  try {
    await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const point = (await session.query('SELECT pg_export_snapshot() AS snapshot,clock_timestamp() AS observed_at')).rows[0];
    if (!/^[A-Fa-f0-9-]+$/.test(point.snapshot)) throw new Error('M5_RESTORE_SNAPSHOT_ID');
    snapshotAt = point.observed_at.toISOString();
    snapshot = await databaseSnapshot(session);
    backup = command(['--context', context, 'exec', postgresId, 'pg_dump', '-U', 'ezihubb_m5', '-d', SCENARIO_DATABASE,
      '--format=custom', '--schema=public', '--no-owner', '--no-privileges', `--snapshot=${point.snapshot}`], env);
    if (backup.length < 1 || backup.length > MAX_BACKUP_BYTES) throw new Error('M5_RESTORE_BACKUP_SIZE');
    writeFileSync(file, backup, { flag: 'wx', mode: 0o600 });
    await session.query('COMMIT');
  } catch (error) { await session.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { session.release(); }
  const backupSha256 = createHash('sha256').update(backup).digest('hex');
  const createsPublic = archiveCreatesPublicSchema(command(['--context', context, 'exec', '-i', postgresId, 'pg_restore', '--list'], env, backup).toString());
  // Deliberately ACK one write AFTER the snapshot, proving measurable backup-only loss.
  const later = await createProduct(sourceDb, catalog, { name: 'post-snapshot-acknowledged-write', quantity: 9 });
  const lastAcknowledgedAt = (await sourcePool.query('SELECT clock_timestamp() AS time')).rows[0].time.toISOString();
  const sourceAfter = await databaseSnapshot(sourcePool);
  const bootstrapUrl = new URL(cleanChildEnvironment(env, SCENARIO_DATABASE).DATABASE_URL);
  bootstrapUrl.username = 'm5_bootstrap'; bootstrapUrl.password = env['M5_BOOTSTRAP_PASSWORD'];
  const bootstrap = new Pool({ connectionString: bootstrapUrl.href, max: 1, connectionTimeoutMillis: 5000,
    options: '-c statement_timeout=60000 -c lock_timeout=10000' });
  let restoredPool: Pool | undefined, restored: PrismaClient | undefined, targetBootstrap: Pool | undefined;
  const rtoStart = performance.now();
  try {
    const authority = (await bootstrap.query("SELECT current_user AS role,current_database() AS database,(SELECT token FROM m5_guard.environment WHERE singleton) AS token")).rows[0];
    if (authority.role !== 'm5_bootstrap' || authority.database !== SCENARIO_DATABASE || authority.token !== env['M5_DATABASE_TOKEN']) throw new Error('M5_RESTORE_BOOTSTRAP_IDENTITY');
    if ((await bootstrap.query('SELECT 1 FROM pg_database WHERE datname=$1', [target])).rowCount) throw new Error('M5_RESTORE_TARGET_EXISTS');
    // Only a freshly generated fixed-prefix database; NEVER drop/reset an existing target.
    await bootstrap.query(`CREATE DATABASE "${target}" OWNER ezihubb_m5 TEMPLATE template0`);
    await bootstrap.query(`REVOKE CONNECT ON DATABASE "${target}" FROM PUBLIC`);
    await bootstrap.query(`GRANT CONNECT ON DATABASE "${target}" TO ezihubb_m5`);
    bootstrapUrl.pathname = `/${target}`;
    targetBootstrap = new Pool({ connectionString: bootstrapUrl.href, max: 1, connectionTimeoutMillis: 5000 });
    if (createsPublic) {
      // Fresh template0 has an empty public namespace. Preserve it by rename
      // instead of dropping it; let this archive create its original namespace.
      assert.equal((await targetBootstrap.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'")).rows[0].count, 0);
      await targetBootstrap.query('ALTER SCHEMA public RENAME TO m5_empty_public');
    }
    await targetBootstrap.query('CREATE SCHEMA m5_guard AUTHORIZATION m5_bootstrap');
    await targetBootstrap.query('CREATE TABLE m5_guard.environment(singleton boolean PRIMARY KEY CHECK(singleton),token text NOT NULL)');
    await targetBootstrap.query('INSERT INTO m5_guard.environment VALUES(true,$1)', [env['M5_DATABASE_TOKEN']]);
    await targetBootstrap.query('CREATE TABLE m5_guard.fixture_receipt(name text PRIMARY KEY,payload jsonb NOT NULL)');
    await targetBootstrap.query('GRANT USAGE ON SCHEMA m5_guard TO ezihubb_m5');
    await targetBootstrap.query('GRANT SELECT ON m5_guard.environment TO ezihubb_m5');
    await targetBootstrap.query('GRANT SELECT,INSERT ON m5_guard.fixture_receipt TO ezihubb_m5');
    await targetBootstrap.query('INSERT INTO m5_guard.fixture_receipt VALUES($1,$2::jsonb)',
      [`m5-recovery-restore:${runId}`, JSON.stringify({ runId, source: SCENARIO_DATABASE, backupSha256, scope: 'SYNTHETIC_ONLY' })]);
    const restoredUrl = new URL(cleanChildEnvironment(env, SCENARIO_DATABASE).DATABASE_URL); restoredUrl.pathname = `/${target}`;
    restoredPool = new Pool({ connectionString: restoredUrl.href, max: 1, connectionTimeoutMillis: 5000,
      options: '-c statement_timeout=60000 -c lock_timeout=10000' });
    const identity = (await restoredPool.query(`SELECT current_database() AS database,current_user AS role,
      (SELECT token FROM m5_guard.environment WHERE singleton) AS token,
      (SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user) AS privileged`)).rows[0];
    if (identity.database !== target || identity.role !== 'ezihubb_m5' || identity.privileged || identity.token !== env['M5_DATABASE_TOKEN']) throw new Error('M5_RESTORE_TARGET_IDENTITY');
    assert.equal((await restoredPool.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count, 0);
    const info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== backup.length) throw new Error('M5_RESTORE_BACKUP_CHANGED');
    const bytes = readFileSync(file);
    if (createHash('sha256').update(bytes).digest('hex') !== backupSha256) throw new Error('M5_RESTORE_BACKUP_CHANGED');
    inspectOwned(context, env, postgresId, 'postgres');
    command(['--context', context, 'exec', '-i', postgresId, 'pg_restore', '-U', 'ezihubb_m5', '-d', target,
      '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction'], env, bytes);
    assertSnapshotEqual(snapshot, await databaseSnapshot(restoredPool));
    restored = new PrismaClient({ adapter: new PrismaPg(restoredPool), log: [] });
    const event = await restored.economicOutbox.findUniqueOrThrow({ where: { id: replayEventId } });
    assert.equal(await consumeVerifiedEconomics(restored, event, 'TEST'), false);
    assertSnapshotEqual(snapshot, await databaseSnapshot(restoredPool));
    assert.equal(await restored.product.count({ where: { id: later.product.id } }), 0);
    assert.equal((await sourceDb.product.findUniqueOrThrow({ where: { id: later.product.id } })).quantity, 9);
    assertSnapshotEqual(sourceAfter, await databaseSnapshot(sourcePool));
    const metrics = measureRestore({ snapshotAt, lastAcknowledgedAt, missingAcknowledgements: 1, rtoMs: performance.now() - rtoStart });
    await restoredPool.query('INSERT INTO m5_guard.fixture_receipt(name,payload) VALUES($1,$2::jsonb)',
      [`m5-recovery-verified:${runId}`, JSON.stringify({ snapshotHash: snapshotHash(snapshot), backupSha256, metrics })]);
    return { database: target, backupSha256, backupBytes: backup.length, snapshotHash: snapshotHash(snapshot),
      snapshotMatched: true, replayDeduplicated: true, sourcePreserved: true, metrics,
      scope: 'PUBLIC_POSTGRES_SCHEMA_ONLY_NOT_REDIS_MONGO_STORAGE', retainedPrivateBackup: true };
  } finally {
    await restored?.$disconnect(); await restoredPool?.end(); await targetBootstrap?.end(); await bootstrap.end();
  }
}
