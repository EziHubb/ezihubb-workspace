module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      diagnostics: { warnOnly: true },  // TS errors are warnings, not failures
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',

  // Integration tests require a live DB — run separately in CI with --testPathPattern
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.spec\\.ts$',  // excluded from default run; use --testPathPattern to include
  ],

  // Global threshold is intentionally low — only the P1-08 critical flows are unit-tested.
  coverageThreshold: {
    global: { lines: 25, functions: 20 },
  },

  // Increase timeout for tests that spin up NestJS modules
  testTimeout: 30_000,
};
