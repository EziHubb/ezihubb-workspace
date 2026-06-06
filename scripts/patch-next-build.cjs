/**
 * Postinstall patches for Next.js 16 + @nx/next build issues:
 *
 * Patch 1 — build/utils.js: return isStatic:false for /_global-error.
 *   Belt-and-suspenders; App Router ignores this field but future Next.js
 *   versions might check it.
 *
 * Patch 2 — build/index.js: skip adding /_global-error to staticPaths.
 *   Root cause of the prerender crash: the App Router branch unconditionally
 *   adds /_global-error to staticPaths when !isDynamic. The export worker
 *   then tries to prerender it, which calls useContext(LayoutRouterContext)
 *   but React is null in the static-gen worker for this synthetic route.
 *
 * Patch 3 — @nx/next build executor: force NODE_ENV=production.
 *   Nx may leave a non-standard NODE_ENV in the environment before spawning
 *   next build. The executor uses ||= which doesn't override it. Next.js
 *   warns about non-standard NODE_ENV and the static-gen workers crash
 *   (useContext null) when NODE_ENV is not 'production'.
 *
 * Remove this script once the upstream fixes land.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function patch(relPath, needle, replacement, label) {
  const file = path.join(root, 'node_modules', 'next', 'dist', relPath);
  if (!fs.existsSync(file)) {
    console.log(`patch-next-build: ${relPath} not found, skipping`);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes(replacement)) {
    console.log(`patch-next-build: ${label} already applied`);
    return;
  }
  if (!content.includes(needle)) {
    console.warn(`patch-next-build: ${label} — expected string not found; Next.js version may have changed. Verify manually.`);
    return;
  }
  fs.writeFileSync(file, content.replace(needle, replacement), 'utf8');
  console.log(`patch-next-build: applied ${label}`);
}

// Patch 1: build/utils.js — isStatic:false for /_global-error
patch(
  'build/utils.js',
  '    // Skip page data collection for synthetic _global-error routes\n    if (page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE) {\n        return {\n            isStatic: true,',
  '    // Skip page data collection for synthetic _global-error routes\n    // isStatic:false: belt-and-suspenders guard against static-gen prerender crash.\n    if (page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE) {\n        return {\n            isStatic: false,',
  'utils.js isStatic:false'
);

// Patch 2: build/index.js — skip /_global-error when populating staticPaths
patch(
  'build/index.js',
  '                                                if (!isDynamic) {\n                                                    staticPaths.set(originalAppPath, [',
  '                                                // Skip /_global-error: prerender crashes in Next.js 16 (useContext null in static-gen worker).\n                                                if (!isDynamic && page !== _entryconstants.UNDERSCORE_GLOBAL_ERROR_ROUTE) {\n                                                    staticPaths.set(originalAppPath, [',
  'index.js skip /_global-error staticPaths'
);

// Patch 3: @nx/next build executor — force NODE_ENV=production
// Nx may set a non-standard NODE_ENV before spawning next build; ||= doesn't override it.
{
  const nxBuildImpl = path.join(root, 'node_modules/@nx/next/src/executors/build/build.impl.js');
  if (fs.existsSync(nxBuildImpl)) {
    let c = fs.readFileSync(nxBuildImpl, 'utf8');
    const needle      = "process.env.NODE_ENV ||= 'production';";
    const replacement = "process.env.NODE_ENV = 'production';";
    if (c.includes(replacement)) {
      console.log('patch-next-build: @nx/next build.impl.js NODE_ENV=production already applied');
    } else if (!c.includes(needle)) {
      console.warn('patch-next-build: @nx/next build.impl.js — expected string not found; version may have changed.');
    } else {
      fs.writeFileSync(nxBuildImpl, c.replace(needle, replacement), 'utf8');
      console.log('patch-next-build: applied @nx/next build.impl.js NODE_ENV=production');
    }
  }
}
