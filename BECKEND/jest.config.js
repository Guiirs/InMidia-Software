/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  maxWorkers: 2,
  workerIdleMemoryLimit: '768MB',
  cacheDirectory: '<rootDir>/.jest-cache',
  collectCoverage: false,
  detectOpenHandles: false,
  forceExit: false,
  transform: {
    // MEMORY OPTIMIZATION: diagnostics: false para testes normais
    // Type checking é feito separadamente via: npx tsc --noEmit
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: process.env.TS_JEST_DIAGNOSTICS === 'true',
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@scripts/(.*)$': '<rootDir>/src/scripts/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/shared/infra/http/middlewares/$1',
    '^@routes/(.*)$': '<rootDir>/src/shared/infra/http/routes/$1',
    '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@gateway/(.*)$': '<rootDir>/src/gateway/$1',
    '^@security/(.*)$': '<rootDir>/src/security/$1',
  },
  passWithNoTests: true,
};
