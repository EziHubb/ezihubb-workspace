import type { Config } from 'jest';

const config: Config = {
  displayName:     'integration',
  testEnvironment: 'node',
  testMatch:       ['<rootDir>/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  transform:       { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }] },
  testTimeout:     30_000,
  globalSetup:     '<rootDir>/globalSetup.ts',
  setupFiles:      ['<rootDir>/setup.ts'],
  // Run serially — we're hitting a real API
  maxWorkers:      1,
  verbose:         true,
};

export default config;
