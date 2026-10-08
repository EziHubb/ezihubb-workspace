import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

// PGlite's WASM loader needs native dynamic import, outside Jest's VM. Keep this
// in the normal Nx/Jest test target; no experimental VM flags or external DB.
it('runs the real economic migration constraints in isolated PostgreSQL', async () => {
  const root = resolve(__dirname, '../../../../..');
  try {
    const { stdout } = await promisify(execFile)(process.execPath, [
      '--import', pathToFileURL(require.resolve('tsx')).href, '--test', '--test-reporter=tap',
      resolve(root, 'apps/api/test/economic-migrations.sql-check.ts'),
    ], { cwd: root, timeout: 90_000, maxBuffer: 1024 * 1024 });
    expect(stdout).toMatch(/# tests [1-9]\d*/);
    expect(stdout).toContain('# fail 0');
    expect(stdout).toContain('# cancelled 0');
    expect(stdout).toContain('# skipped 0');
    expect(stdout).toContain('persists signed rounding plans for successive quantities');
    expect(stdout).toContain('verifies original multi-shop affiliate residual ownership');
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    // Only synthetic fixtures are used by this subprocess; no credentials/DSN.
    throw new Error(`${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`);
  }
}, 100_000);
