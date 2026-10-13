const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

// Migration-owned partial/expression indexes cannot all be expressed by the
// current Prisma schema. Assert their complete definitions, never ignore them.
const MANUAL_INDEXES = [
  {
    name: 'Conversation_store_guest_key',
    definition: 'CREATE UNIQUE INDEX "Conversation_store_guest_key" ON public."Conversation" USING btree ("storeId", lower("guestEmail")) WHERE (("storeId" IS NOT NULL) AND ("userId" IS NULL) AND ("guestEmail" IS NOT NULL))',
  },
  {
    name: 'Conversation_store_user_key',
    definition: 'CREATE UNIQUE INDEX "Conversation_store_user_key" ON public."Conversation" USING btree ("storeId", "userId") WHERE (("storeId" IS NOT NULL) AND ("userId" IS NOT NULL))',
  },
  {
    name: 'StoreOrder_shippingSubsidy_createdAt_idx',
    definition: 'CREATE INDEX "StoreOrder_shippingSubsidy_createdAt_idx" ON public."StoreOrder" USING btree ("createdAt" DESC) WHERE ("shippingSubsidy" > (0)::numeric)',
  },
];

// Generate the ORM contract without reading the workspace .env or connecting to
// a datasource. The M5 config only accepts this synthetic loopback identity.
function prismaSchemaSql(root) {
  const result = spawnSync(process.execPath, [
    resolve(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff',
    '--from-empty', '--to-schema', resolve(root, 'prisma/schema.prisma'), '--script',
    '--config', resolve(root, 'scripts/m5/prisma.config.ts'),
  ], {
    cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
    env: {
      PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
      DATABASE_URL: 'postgresql://ezihubb_m5:synthetic@127.0.0.1:15432/ezihubb_m5_fresh',
      M5_ENVIRONMENT: 'local-synthetic-v1',
    },
  });
  if (result.error || result.status !== 0 || !result.stdout.includes('CREATE TABLE')) {
    throw new Error('M5_SCHEMA_SQL_GENERATION_FAILED');
  }
  return result.stdout;
}

async function schemaCatalog(db) {
  const foreignKeys = (await db.query(`SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
    WHERE n.nspname='public' AND c.contype='f' ORDER BY c.conname`)).rows;
  const indexes = (await db.query(`SELECT indexname AS name, indexdef AS definition
    FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`)).rows;
  return { foreignKeys, indexes };
}

async function expectedSchemaCatalog(root) {
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  await db.waitReady;
  try {
    // Only the default's signature is needed for catalog comparison; no rows
    // are inserted and this is NOT a test of the production nanoid function.
    await db.exec(`CREATE FUNCTION nanoid(size integer DEFAULT 12) RETURNS text
      LANGUAGE sql AS 'SELECT repeat(''x'', size)'`);
    await db.exec(prismaSchemaSql(root));
    const catalog = await schemaCatalog(db);
    catalog.indexes.push(...MANUAL_INDEXES);
    // Match PostgreSQL ORDER BY conname/indexname (case-sensitive ASCII names).
    catalog.indexes.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    return catalog;
  } finally { await db.close(); }
}

module.exports = { prismaSchemaSql, schemaCatalog, expectedSchemaCatalog };
