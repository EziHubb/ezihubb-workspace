module.exports = {
  displayName:        'api-e2e',
  testEnvironment:    'node',
  testRegex:          '.e2e-spec\\.ts$',
  rootDir:            '.',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '../tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@mlh/constants(.*)$': '<rootDir>/../../../libs/shared/constants/src/index.ts$1',
    '^@mlh/types(.*)$':     '<rootDir>/../../../libs/shared/types/src/index.ts$1',
  },
  globalSetup:    './setup.ts',
  globalTeardown: './teardown.ts',
};
