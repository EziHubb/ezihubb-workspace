import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env manually — prisma db seed does not inject it into the child process.
if (!process.env['DATABASE_URL']) {
  try {
    const seedDir = dirname(fileURLToPath((import.meta as { url: string }).url));
    const envPath = resolve(seedDir, '..', '..', '..', '.env');
    const lines   = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, '');
      if (v) process.env[m[1]] = v;
    }
  } catch (e) {
    console.warn('  ⚠  Could not load .env:', (e as Error).message);
  }
}

const dbUrl = process.env['DATABASE_URL'] ?? '';
if (!dbUrl) throw new Error('DATABASE_URL is not set. Create a .env file at the workspace root.');

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
});

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
