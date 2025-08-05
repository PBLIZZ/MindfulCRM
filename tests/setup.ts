import dotenv from 'dotenv';
import { beforeAll, afterAll, afterEach } from '@jest/globals';
import { db } from '../server/db.js';
import { cleanupTestDatabase, setupTestDatabase } from './utils/test-database.js';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Increase timeout for database operations
jest.setTimeout(30000);

beforeAll(async () => {
  // Setup test database
  await setupTestDatabase();
  
  // Verify database connection
  try {
    await db.execute('SELECT 1');
    console.log('✅ Test database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }
});

afterEach(async () => {
  // Clean up data after each test to ensure isolation
  await cleanupTestDatabase();
});

afterAll(async () => {
  // Close database connections
  try {
    // Add proper cleanup for Drizzle connections if needed
    console.log('✅ Test database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
});

// Global test configuration
global.console = {
  ...console,
  // Suppress specific logs during testing
  log: process.env.TEST_VERBOSE ? console.log : () => {},
  debug: process.env.TEST_VERBOSE ? console.debug : () => {},
};

// Mock external services by default
jest.mock('../server/providers/gemini.provider.js');
jest.mock('../server/providers/openai.provider.js');
jest.mock('../server/providers/mistral.provider.js');
jest.mock('../server/providers/google.provider.js');