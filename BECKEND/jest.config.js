/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    // diagnostics: true (padrão) — ARCH-11: todos os arquivos ativos estão
    // livres de @ts-nocheck. Erros de tipo em código de teste são agora erros reais.
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: true,
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
