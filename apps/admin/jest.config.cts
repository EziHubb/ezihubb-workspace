const nextJest = require('next/jest.js');

const createJestConfig = nextJest({
  // Use __dirname so the path is correct whether Jest runs from the workspace
  // root (via `nx test admin`) or from within the admin directory directly.
  dir: __dirname,
});

const config = {
  displayName: 'admin',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/admin',
  testEnvironment: '<rootDir>/src/test/jest-env.ts',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};

const jestConfig = createJestConfig(config);

module.exports = async () => {
  const resolved = await jestConfig();

  // Disable SWC path alias resolution — handled by Nx jest resolver.
  for (const value of Object.values(resolved.transform)) {
    if (Array.isArray(value) && value[1]?.resolvedBaseUrl) {
      value[1] = { ...value[1], resolvedBaseUrl: undefined };
    }
  }

  return resolved;
};
