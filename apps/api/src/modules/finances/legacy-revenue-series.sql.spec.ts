import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

// PGlite needs native dynamic import outside Jest's VM. Keep verification within
// the regular Nx target, using no external database, DSN or credentials.
it('executes original historical revenue reader SQL against isolated multi-shop fixtures', async () => {
  const root = resolve(__dirname, '../../../../..');
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [
      '--import', pathToFileURL(require.resolve('tsx')).href, '--test', '--test-reporter=tap',
      resolve(root, 'apps/api/test/legacy-revenue-series.sql-check.ts'),
    ], { cwd: root, timeout: 60_000, maxBuffer: 1024 * 1024 });
    expect(stdout).toContain('# tests 7');
    expect(stdout).toContain('# fail 0');
    expect(stdout).toContain('# cancelled 0');
    expect(stdout).toContain('# skipped 0');
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(`${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`);
  }
}, 70_000);
