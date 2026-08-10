#!/usr/bin/env node
// Refuses to let a schema-wiping command (db:drop:pg, db:reset:pg) run
// against anything that isn't an obviously-local database — the only thing
// standing between a mistyped/copied-over DATABASE_URL and permanently
// wiping the production schema. Chained in package.json before the real
// command: `node scripts/guard-destructive-db.cjs && prisma ...`.
//
// Override (only if you really mean it): DB_GUARD_OVERRIDE=yes-i-am-sure

const { readFileSync } = require('fs');
const { resolve } = require('path');

try {
  const lines = readFileSync(resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
} catch { /* .env not found — rely on system env */ }

const url = process.env.DATABASE_URL || '';
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  console.error('✗ DATABASE_URL is missing or not a valid connection string — refusing to run.');
  process.exit(1);
}

const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(host);

if (!isLocal && process.env.DB_GUARD_OVERRIDE !== 'yes-i-am-sure') {
  console.error(`
✗ Refusing to run — DATABASE_URL points at "${host}", not localhost.
  This command drops/wipes the entire schema. If this is genuinely a
  disposable dev/staging database and you're sure, re-run with:
    DB_GUARD_OVERRIDE=yes-i-am-sure <the same command>
`);
  process.exit(1);
}
