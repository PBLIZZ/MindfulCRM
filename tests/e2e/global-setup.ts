/**
 * Global setup for E2E tests
 * Configures test environment, database, and authentication
 */

import { chromium, type FullConfig } from '@playwright/test';
import { seedTestData, cleanupTestDatabase } from '../utils/test-database.js';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');

  try {
    // Clean up any existing test data
    await cleanupTestDatabase();
    console.log('✅ Cleaned up test database');

    // Seed test data for E2E tests
    const testData = await seedTestData();
    console.log(`✅ Seeded test data: ${testData.users.length} users, ${testData.contacts.length} contacts`);

    // Start the application server if needed
    // This would typically start your dev server
    // For now, we assume the server is already running

    // Set up authentication if needed
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to app and perform authentication
    await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173');

    // Mock authentication for E2E tests
    await page.addInitScript(() => {
      // Set up authentication state
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user-wellness-coach',
        email: 'coach@mindfulcrm.com',
        name: 'Sarah Wellness Coach'
      }));
    });

    // Save authentication state
    await context.storageState({ path: 'tests/e2e/auth-state.json' });

    await browser.close();

    console.log('✅ E2E test setup completed successfully');

  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
    throw error;
  }
}

export default globalSetup;