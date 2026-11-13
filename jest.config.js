/**
 * unit: pure functions and resolvers, no network or database.
 * e2e:  the socket subgraph and the gateway run in-process on ephemeral ports
 *       against a throwaway MongoDB (MONGO_URI); Open Charge Map is stubbed.
 */
const shared = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};

module.exports = {
  projects: [
    { ...shared, displayName: 'unit', testMatch: ['<rootDir>/src/**/test/unit/**/*.test.ts'] },
    {
      ...shared,
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/**/test/e2e/**/*.test.ts', '<rootDir>/test/e2e/**/*.test.ts'],
    },
  ],
  collectCoverageFrom: ['src/**/src/**/*.ts', '!src/**/src/test/**', '!src/**/src/type/**', '!src/**/src/index.ts'],
  // Starting servers and building indexes on a busy machine takes longer than
  // Jest's 5 s default. testTimeout is a global option: Jest ignores it inside a project.
  testTimeout: 30000,
  coverageReporters: ['text-summary', 'text', 'lcov'],
};
