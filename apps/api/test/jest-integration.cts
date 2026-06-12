module.exports = {
  displayName: 'api-integration',
  testEnvironment: 'node',
  testRegex: '\\.integration\\.spec\\.ts$',
  rootDir: '.',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '../tsconfig.spec.json',
      diagnostics: { warnOnly: true },
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@mlh/constants(.*)$': '<rootDir>/../../../libs/shared/constants/src/index.ts$1',
    '^@mlh/types(.*)$': '<rootDir>/../../../libs/shared/types/src/index.ts$1',
    '^@mlh/utils(.*)$': '<rootDir>/../../../libs/shared/utils/src/index.ts$1',
  },
  testTimeout: 30000,
};
