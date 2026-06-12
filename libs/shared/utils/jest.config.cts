module.exports = {
  displayName: 'shared-utils',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      diagnostics: { warnOnly: true },
    }],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../../coverage/libs/shared/utils',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
};
