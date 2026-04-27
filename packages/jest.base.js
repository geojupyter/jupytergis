/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    // Resolve @/* path alias (tsconfig: "@/*" -> "./*" relative to package root)
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(tsx?|js)$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  // Transform ESM-only packages that have no CommonJS build
  transformIgnorePatterns: ['/node_modules/(?!(d3-.*|@jupyter/ydoc)/)'],
};
