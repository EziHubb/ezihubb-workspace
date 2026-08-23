import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Prisma CLI may not inject `.env` into process.env before evaluating this file.
// Load it here so datasource.url and the adapter always have the correct values.
try {
  const lines = readFileSync(resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
} catch { /* .env not found — rely on system env */ }

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env['DATABASE_URL']!,
  },
  migrate: {
    async adapter(env) {
      const pool = new Pool({ connectionString: env['DATABASE_URL'] });
      return new PrismaPg(pool);
    },
  },
  migrations: {
    seed: 'ts-node prisma/seed-baseline.ts',
  },
});
