/**
 * Global teardown for E2E tests
 * Cleans up test environment and resources
 */

import { type FullConfig } from '@playwright/test';
import { cleanupTestDatabase } from '../utils/test-database.js';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test teardown...');

  try {
    // Clean up test data
    await cleanupTestDatabase();
    console.log('✅ Cleaned up test database');

    // Remove authentication state file
    const authStatePath = 'tests/e2e/auth-state.json';
    if (fs.existsSync(authStatePath)) {
      fs.unlinkSync(authStatePath);
      console.log('✅ Removed authentication state file');
    }

    // Clean up any uploaded test files
    const uploadsDir = path.join(process.cwd(), 'uploads', 'test-contact-photos');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
      console.log(`✅ Cleaned up ${files.length} test upload files`);
    }

    // Clean up any temporary files
    const tempDir = path.join(process.cwd(), 'temp');
    if (fs.existsSync(tempDir)) {
      const tempFiles = fs.readdirSync(tempDir).filter(file => file.startsWith('test-'));
      for (const file of tempFiles) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      console.log(`✅ Cleaned up ${tempFiles.length} temporary test files`);
    }

    console.log('✅ E2E test teardown completed successfully');

  } catch (error) {
    console.error('❌ E2E test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown;
