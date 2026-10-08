import { defineConfig } from 'prisma/config';
import { resolve, relative } from 'node:path';

// Deliberately never import root prisma.config.ts: it loads the private .env.
const root = resolve(__dirname, '../..');
const url = new URL(process.env['DATABASE_URL'] ?? '');
if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '15432'
  || url.username !== 'ezihubb_m5' || !['/ezihubb_m5_fresh', '/ezihubb_m5_upgrade', '/ezihubb_m5_scenarios'].includes(url.pathname)
  || url.search || url.hash || process.env['M5_ENVIRONMENT'] !== 'local-synthetic-v1') {
  throw new Error('M5_DATABASE_IDENTITY');
}
const migrationPath = resolve(process.env['M5_MIGRATIONS_PATH'] ?? resolve(root, 'prisma/migrations'));
const rel = relative(resolve(root, 'tmp/m5'), migrationPath);
if (migrationPath !== resolve(root, 'prisma/migrations') && (rel.startsWith('..') || rel.includes(':'))) {
  throw new Error('M5_MIGRATION_DIRECTORY');
}
export default defineConfig({
  schema: resolve(root, 'prisma/schema.prisma'),
  datasource: { url: url.href },
  migrations: { path: migrationPath },
});
