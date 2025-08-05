/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json'
    }]
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'server/**/*.ts',
    'client/src/**/*.{ts,tsx}',
    '!server/index.ts',
    '!server/vite.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.d.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: '50%',
  
  // Test environment configuration
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // Module resolution for ESM
  resolver: '<rootDir>/tests/jest-resolver.js',
  
  // Coverage thresholds - start conservative, increase over time
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40
    },
    // Critical modules should have higher coverage
    'server/services/*.ts': {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    },
    'server/data/*.ts': {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};