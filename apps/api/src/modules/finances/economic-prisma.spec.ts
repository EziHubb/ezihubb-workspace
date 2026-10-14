import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

// Native Node loading avoids Prisma's WASM loader crossing Jest's VM boundary.
// The child uses synthetic read-only transports, never a live database/provider.
it('validates economic selectors and retry classification with the actual Prisma client/PG adapter', async () => {
  const root = resolve(__dirname, '../../../../..');
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [
      '--import', pathToFileURL(require.resolve('tsx')).href, '--test', '--test-reporter=tap',
      resolve(root, 'apps/api/test/economic-prisma.client-check.ts'),
    ], { cwd: root, timeout: 30_000, maxBuffer: 1024 * 1024 });
    expect(stdout).toContain('# tests 4');
    expect(stdout).toContain('# fail 0');
    expect(stdout).toContain('# cancelled 0');
    expect(stdout).toContain('# skipped 0');
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`);
  }
}, 35_000);
