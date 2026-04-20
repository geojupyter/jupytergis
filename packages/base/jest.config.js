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
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Jest runs in CommonJS; override the project's esnext module setting
          module: 'commonjs',
          paths: { '@/*': ['./*'] },
          types: ['jest', 'node'],
        },
      },
    ],
  },
  // Transform ESM-only packages that have no CommonJS build
  transformIgnorePatterns: ['/node_modules/(?!(d3-scale-chromatic|d3-color)/)'],
};
