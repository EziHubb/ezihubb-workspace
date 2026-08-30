import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const nextDir = process.argv[2];
const sharedLimitKb = Number(process.argv[3] ?? 250);
const chunkLimitKb = Number(process.argv[4] ?? 120);

if (!nextDir) {
  throw new Error(
    'Usage: node scripts/check-next-bundle-size.mjs <.next-dir> [shared-kb] [chunk-kb]',
  );
}

const manifestPath = path.join(nextDir, 'build-manifest.json');
await stat(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const files = [
  ...(manifest.polyfillFiles ?? []),
  ...(manifest.rootMainFiles ?? []),
];

if (files.length === 0) {
  throw new Error(`No shared JavaScript files found in ${manifestPath}`);
}

const sizes = await Promise.all(
  [...new Set(files)].map(async (relativePath) => {
    const contents = await readFile(path.join(nextDir, relativePath));
    return {
      relativePath,
      gzipKb: gzipSync(contents).byteLength / 1024,
    };
  }),
);

const sharedKb = sizes.reduce((total, file) => total + file.gzipKb, 0);
const largest = sizes.reduce((current, file) =>
  file.gzipKb > current.gzipKb ? file : current,
);

console.log(`Shared startup JavaScript: ${sharedKb.toFixed(1)} kB gzip`);
console.log(
  `Largest shared chunk: ${largest.gzipKb.toFixed(1)} kB gzip (${largest.relativePath})`,
);

const failures = [];
if (sharedKb > sharedLimitKb) {
  failures.push(
    `shared startup JavaScript exceeds ${sharedLimitKb} kB (${sharedKb.toFixed(1)} kB)`,
  );
}
if (largest.gzipKb > chunkLimitKb) {
  failures.push(
    `largest shared chunk exceeds ${chunkLimitKb} kB (${largest.gzipKb.toFixed(1)} kB)`,
  );
}

if (failures.length > 0) {
  throw new Error(`Bundle budget failed: ${failures.join('; ')}`);
}
