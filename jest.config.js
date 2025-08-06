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
  
  // Coverage thresholds - progressive increases toward 80-90%
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 65,
      statements: 65
    },
    // Critical modules require higher coverage
    'server/services/*.ts': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'server/data/*.ts': {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Business logic brains need comprehensive testing
    'server/brains/*.ts': {
      branches: 65,
      functions: 75,
      lines: 75,
      statements: 75
    },
    // Client components should be well tested
    'client/src/components/**/*.{ts,tsx}': {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Test categorization for phased approach
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/tests/unit/**/*.test.ts',
    '**/tests/unit/**/*.test.tsx',
    '**/tests/integration/**/*.test.ts',
    '**/tests/integration/**/*.test.tsx',
    '**/tests/performance/**/*.test.ts'
  ],
  
  // Exclude e2e tests from Jest (use Playwright)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/e2e/',
    '/coverage/'
  ]
};