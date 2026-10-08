const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { ROOT } = require('./recovery-support.cjs');
const { generateEnvironment, cleanChildEnvironment } = require('./guard.cjs');
// Explicit tsconfig is required for the production controller's decorators.
// The contract suite may run below the native baseline, without infrastructure.
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', resolve(ROOT, 'scripts/m5/recovery.test.ts')],
  { cwd: ROOT, windowsHide: true, stdio: 'inherit',
    env: { ...cleanChildEnvironment(generateEnvironment()), TSX_TSCONFIG_PATH: resolve(ROOT, 'scripts/m5/recovery-runtime.tsconfig.json') } });
process.exitCode = result.error ? 1 : result.status ?? 1;
