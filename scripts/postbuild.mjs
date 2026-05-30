/**
 * Postbuild script: copies static assets into each Next.js standalone directory.
 *
 * Next.js standalone output requires these directories to be co-located with server.js:
 *   .next/static   — JS/CSS chunks, fonts
 *   public/        — static assets
 *   messages/      — next-intl translation files
 *
 * Run AFTER `pnpm nx run-many -t build` so dist/ already exists.
 */

import { cpSync, existsSync, mkdirSync } from 'fs';

const APPS = ['client', 'admin'];

let anyError = false;

for (const app of APPS) {
  const nextDir      = `dist/apps/${app}/.next`;
  const standaloneApp = `${nextDir}/standalone/apps/${app}`;
  const serverJs     = `${standaloneApp}/server.js`;

  if (!existsSync(serverJs)) {
    console.warn(`[postbuild] ⚠ ${app}: server.js not found at ${serverJs} — skipping`);
    continue;
  }

  let copied = 0;

  // .next/static — JS/CSS/font chunks
  const staticSrc  = `${nextDir}/static`;
  const staticDest = `${standaloneApp}/.next/static`;
  if (existsSync(staticSrc) && !existsSync(staticDest)) {
    mkdirSync(staticDest, { recursive: true });
    cpSync(staticSrc, staticDest, { recursive: true });
    console.log(`[postbuild] ✓ ${app}: .next/static copied`);
    copied++;
  }

  // public/
  const publicSrc  = `apps/${app}/public`;
  const publicDest = `${standaloneApp}/public`;
  if (existsSync(publicSrc) && !existsSync(publicDest)) {
    mkdirSync(publicDest, { recursive: true });
    cpSync(publicSrc, publicDest, { recursive: true });
    console.log(`[postbuild] ✓ ${app}: public/ copied`);
    copied++;
  }

  // messages/ — next-intl translations
  const msgSrc  = `apps/${app}/messages`;
  const msgDest = `${standaloneApp}/messages`;
  if (existsSync(msgSrc) && !existsSync(msgDest)) {
    mkdirSync(msgDest, { recursive: true });
    cpSync(msgSrc, msgDest, { recursive: true });
    console.log(`[postbuild] ✓ ${app}: messages/ copied`);
    copied++;
  }

  if (copied === 0) {
    console.log(`[postbuild] ${app}: already up to date`);
  }
}

if (anyError) process.exit(1);
console.log('[postbuild] Done');
