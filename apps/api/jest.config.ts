export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // Plain Node harness helpers are already executable CommonJS, not TS inputs.
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\]', '[/\\\\]scripts[/\\\\]m5[/\\\\].*\\.cjs$'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
  coverageThreshold: {
    global: {
      statements: 25,
      branches: 3,
      functions: 3,
      lines: 25,
    },
  },
};
