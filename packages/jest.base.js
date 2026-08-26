/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    // Resolve @/* path alias (tsconfig: "@/*" -> "./*" relative to package root)
    '^@/(.*)$': '<rootDir>/$1',
    // proj-codes' entry point is ESM and imports its data with a JSON import
    // attribute, which jest cannot parse. The data is the whole package, so
    // point at it directly: the default export is the same object either way.
    '^proj-codes$':
      '<rootDir>/../../node_modules/proj-codes/dist/_generated/proj-codes.json',
  },
  transform: {
    '^.+\\.(tsx?|js)$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  // Transform ESM-only packages that have no CommonJS build
  transformIgnorePatterns: ['/node_modules/(?!(py2vega-ts|vega2ol|vega-.*|d3-.*|@jupyter/ydoc|ol)/)'],
};
