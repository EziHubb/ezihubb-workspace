// Runs `prisma generate` only if prisma/schema.prisma is actually present.
//
// Used as the "prepare" lifecycle script so a plain `pnpm install` still
// auto-generates the Prisma client for local dev/CI (where the full repo is
// checked out), while a Docker build's `base` stage — which installs deps
// from just package.json/pnpm-lock.yaml, before the rest of the repo is
// copied in — can run `pnpm install` without prisma/ present and without
// crashing. See docker/Dockerfile's `source` stage for the explicit
// `prisma generate` call that covers the Docker case instead.
const fs = require('fs');
const { execSync } = require('child_process');

if (fs.existsSync('prisma/schema.prisma')) {
  // `pnpm exec` (not a bare `prisma` call, and not a raw node_modules/.bin
  // path — that doesn't resolve the Windows .cmd shim correctly) so this
  // works cross-platform whether pnpm invokes it as a lifecycle script or
  // it's run directly (e.g. `node scripts/prisma-generate-if-present.cjs`).
  execSync('pnpm exec prisma generate --schema=prisma/schema.prisma', { stdio: 'inherit' });
}
