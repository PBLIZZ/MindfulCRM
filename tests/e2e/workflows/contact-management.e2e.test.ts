/**
 * End-to-end tests for Contact Management workflow
 * Tests complete user journeys through the application
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { TEST_USERS, TEST_CONTACTS } from '../../fixtures/test-data.js';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const TEST_TIMEOUT = 30000;

test.describe('Contact Management E2E Tests', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create browser context with authentication
    context = await browser.newContext({
      baseURL: BASE_URL,
      // Add any authentication cookies or headers here
      extraHTTPHeaders: {
        'X-Test-User-ID': TEST_USERS.WELLNESS_COACH.id
      }
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Mock external API calls to prevent real API usage during E2E tests
    await page.route('**/api/ai/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          message: 'Mocked AI response' 
        })
      });
    });

    await page.route('**/api/google/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          data: [] 
        })
      });
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('Contact List Management', () => {
    test('should display contacts list and allow filtering', async () => {
      // Navigate to contacts page
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Wait for contacts to load
      await expect(page.locator('[data-testid="contacts-table"]')).toBeVisible({ timeout: TEST_TIMEOUT });

      // Check that contact rows are displayed
      const contactRows = page.locator('[data-testid="contact-row"]');
      await expect(contactRows).toHaveCount(3); // Based on test fixture data

      // Test search functionality
      const searchInput = page.locator('[data-testid="contact-search"]');
      await searchInput.fill('Sarah');
      await page.waitForTimeout(500); // Debounce delay

      // Should filter to only Sarah Johnson
      await expect(contactRows).toHaveCount(1);
      await expect(page.locator('text=Sarah Johnson')).toBeVisible();

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);
      await expect(contactRows).toHaveCount(3);
    });

    test('should allow sorting contacts by different columns', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Wait for table to load
      await expect(page.locator('[data-testid="contacts-table"]')).toBeVisible();

      // Get initial order
      const initialNames = await page.locator('[data-testid="contact-name"]').allTextContents();

      // Click on name column header to sort
      await page.locator('[data-testid="sort-name"]').click();
      await page.waitForTimeout(300);

      // Verify sorting changed
      const sortedNames = await page.locator('[data-testid="contact-name"]').allTextContents();
      expect(sortedNames).not.toEqual(initialNames);

      // Click again to reverse sort
      await page.locator('[data-testid="sort-name"]').click();
      await page.waitForTimeout(300);

      const reverseSortedNames = await page.locator('[data-testid="contact-name"]').allTextContents();
      expect(reverseSortedNames).toEqual(sortedNames.reverse());
    });

    test('should handle pagination with large contact lists', async () => {
      // Mock API response with many contacts
      await page.route('**/api/contacts', route => {
        const contacts = Array.from({ length: 50 }, (_, i) => ({
          id: `test-contact-${i}`,
          name: `Test Contact ${i}`,
          email: `test${i}@example.com`,
          lifecycleStage: 'curious',
          sentiment: 3,
          tags: []
        }));

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ contacts })
        });
      });

      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Check pagination appears
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible();

      // Should show first page of results (typically 10-20 per page)
      const contactRows = page.locator('[data-testid="contact-row"]');
      const rowCount = await contactRows.count();
      expect(rowCount).toBeLessThanOrEqual(20);
      expect(rowCount).toBeGreaterThan(0);

      // Navigate to next page
      await page.locator('[data-testid="next-page"]').click();
      await page.waitForLoadState('networkidle');

      // Should show different contacts
      const secondPageContacts = await page.locator('[data-testid="contact-name"]').allTextContents();
      expect(secondPageContacts.length).toBeGreaterThan(0);
    });
  });

  test.describe('Contact Creation Workflow', () => {
    test('should create a new contact successfully', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Click Add Contact button
      await page.locator('[data-testid="add-contact-button"]').click();

      // Fill in contact form
      await page.locator('[data-testid="contact-name-input"]').fill('John Doe');
      await page.locator('[data-testid="contact-email-input"]').fill('john.doe@example.com');
      await page.locator('[data-testid="contact-phone-input"]').fill('+1-555-0199');
      
      // Select lifecycle stage
      await page.locator('[data-testid="lifecycle-stage-select"]').click();
      await page.locator('[data-testid="lifecycle-option-curious"]').click();

      // Mock the API response for contact creation
      await page.route('**/api/contacts', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              contact: {
                id: 'new-contact-123',
                name: 'John Doe',
                email: 'john.doe@example.com',
                phone: '+1-555-0199',
                lifecycleStage: 'curious',
                tags: [],
                createdAt: new Date().toISOString()
              }
            })
          });
        }
      });

      // Submit form
      await page.locator('[data-testid="save-contact-button"]').click();

      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('text=Contact created successfully')).toBeVisible();

      // Verify contact appears in list
      await expect(page.locator('text=John Doe')).toBeVisible();
    });

    test('should validate form inputs and show errors', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="add-contact-button"]').click();

      // Try to submit empty form
      await page.locator('[data-testid="save-contact-button"]').click();

      // Should show validation errors
      await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();

      // Fill invalid email
      await page.locator('[data-testid="contact-name-input"]').fill('Test User');
      await page.locator('[data-testid="contact-email-input"]').fill('invalid-email');
      await page.locator('[data-testid="save-contact-button"]').click();

      await expect(page.locator('text=Please enter a valid email address')).toBeVisible();

      // Fix email and verify error disappears
      await page.locator('[data-testid="contact-email-input"]').fill('valid@example.com');
      await page.locator('[data-testid="contact-name-input"]').click(); // Trigger blur

      await expect(page.locator('[data-testid="email-error"]')).not.toBeVisible();
    });

    test('should handle form submission errors gracefully', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="add-contact-button"]').click();

      // Fill form with duplicate email
      await page.locator('[data-testid="contact-name-input"]').fill('Duplicate Contact');
      await page.locator('[data-testid="contact-email-input"]').fill('sarah.johnson@example.com');

      // Mock server error response
      await page.route('**/api/contacts', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Contact with this email already exists'
            })
          });
        }
      });

      await page.locator('[data-testid="save-contact-button"]').click();

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('text=Contact with this email already exists')).toBeVisible();

      // Form should remain open for correction
      await expect(page.locator('[data-testid="contact-dialog"]')).toBeVisible();
    });
  });

  test.describe('Contact Detail and Editing', () => {
    test('should view and edit contact details', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Click on first contact
      await page.locator('[data-testid="contact-row"]').first().click();

      // Should navigate to contact detail page
      await expect(page).toHaveURL(/\/contacts\/[^\/]+$/);
      await expect(page.locator('[data-testid="contact-detail"]')).toBeVisible();

      // Verify contact information is displayed
      await expect(page.locator('[data-testid="contact-name"]')).toContainText('Sarah Johnson');
      await expect(page.locator('[data-testid="contact-email"]')).toContainText('sarah.johnson@example.com');

      // Edit contact
      await page.locator('[data-testid="edit-contact-button"]').click();

      // Update name
      const nameInput = page.locator('[data-testid="edit-contact-name"]');
      await nameInput.clear();
      await nameInput.fill('Sarah Johnson Smith');

      // Mock update API
      await page.route('**/api/contacts/**', route => {
        if (route.request().method() === 'PUT') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              contact: {
                ...TEST_CONTACTS.ENGAGED_CLIENT,
                name: 'Sarah Johnson Smith',
                tags: []
              }
            })
          });
        }
      });

      await page.locator('[data-testid="save-changes-button"]').click();

      // Verify update
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="contact-name"]')).toContainText('Sarah Johnson Smith');
    });

    test('should manage contact tags', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="contact-row"]').first().click();

      // Open tag management
      await page.locator('[data-testid="manage-tags-button"]').click();

      // Add new tag
      await page.locator('[data-testid="add-tag-input"]').fill('VIP Client');
      await page.locator('[data-testid="tag-color-picker"]').click();
      await page.locator('[data-color="#FFD700"]').click();

      // Mock tag creation
      await page.route('**/api/contacts/*/tags', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            tag: {
              id: 'new-tag-123',
              name: 'VIP Client',
              color: '#FFD700'
            }
          })
        });
      });

      await page.locator('[data-testid="add-tag-button"]').click();

      // Verify tag appears
      await expect(page.locator('[data-testid="contact-tag"]')).toContainText('VIP Client');

      // Remove tag
      await page.locator('[data-testid="remove-tag-button"]').first().click();
      await page.locator('[data-testid="confirm-remove-tag"]').click();

      // Verify tag removed
      await expect(page.locator('[data-testid="contact-tag"]')).not.toContainText('VIP Client');
    });
  });

  test.describe('Photo Upload Workflow', () => {
    test('should upload contact photo successfully', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="contact-row"]').first().click();

      // Click upload photo button
      await page.locator('[data-testid="upload-photo-button"]').click();

      // Mock successful upload
      await page.route('**/api/contacts/*/photo', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            avatarUrl: '/uploads/contact-photos/test-photo.webp',
            photoId: 'photo-123'
          })
        });
      });

      // Create a test file
      const fileContent = 'fake-image-content';
      const file = {
        name: 'profile.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from(fileContent)
      };

      // Upload file
      const fileInput = page.locator('[data-testid="photo-file-input"]');
      await fileInput.setInputFiles({
        name: file.name,
        mimeType: file.mimeType,
        buffer: file.buffer
      });

      // Verify upload success
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
      
      // Verify photo appears
      const avatar = page.locator('[data-testid="contact-avatar"]');
      await expect(avatar).toBeVisible();
      await expect(avatar).toHaveAttribute('src', /\/uploads\/contact-photos\/.*\.webp$/);
    });

    test('should handle photo upload errors', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="contact-row"]').first().click();
      await page.locator('[data-testid="upload-photo-button"]').click();

      // Mock upload error
      await page.route('**/api/contacts/*/photo', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'File too large'
          })
        });
      });

      // Try to upload large file
      const largeFileBuffer = Buffer.alloc(1024 * 1024 * 15); // 15MB
      await page.locator('[data-testid="photo-file-input"]').setInputFiles({
        name: 'large-image.jpg',
        mimeType: 'image/jpeg',
        buffer: largeFileBuffer
      });

      // Should show error message
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(page.locator('text=File too large')).toBeVisible();
    });
  });

  test.describe('Bulk Operations', () => {
    test('should perform bulk tag operations', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Select multiple contacts
      const contactCheckboxes = page.locator('[data-testid="contact-checkbox"]');
      await contactCheckboxes.first().check();
      await contactCheckboxes.nth(1).check();

      // Verify bulk actions toolbar appears
      await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible();
      await expect(page.locator('text=2 contacts selected')).toBeVisible();

      // Add tag to selected contacts
      await page.locator('[data-testid="bulk-add-tag"]').click();
      await page.locator('[data-testid="bulk-tag-name"]').fill('Bulk Tagged');
      await page.locator('[data-testid="bulk-tag-color"]').fill('#32CD32');

      // Mock bulk tag operation
      await page.route('**/api/contacts/bulk/add-tag', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            tagId: 'bulk-tag-123',
            contactTags: [
              { contactId: 'contact-1', tagId: 'bulk-tag-123' },
              { contactId: 'contact-2', tagId: 'bulk-tag-123' }
            ]
          })
        });
      });

      await page.locator('[data-testid="confirm-bulk-tag"]').click();

      // Verify success message
      await expect(page.locator('[data-testid="bulk-success"]')).toBeVisible();
      await expect(page.locator('text=Tag added to 2 contacts')).toBeVisible();

      // Clear selection
      await page.locator('[data-testid="clear-selection"]').click();
      await expect(page.locator('[data-testid="bulk-actions"]')).not.toBeVisible();
    });
  });

  test.describe('AI-Powered Features', () => {
    test('should generate contact insights', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="contact-row"]').first().click();

      // Click AI insights button
      await page.locator('[data-testid="generate-insights-button"]').click();

      // Mock AI insights response
      await page.route('**/api/ai/contacts/*/insights', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            overallSentiment: 4.2,
            engagement: 'high',
            insights: [
              'Very engaged client with consistent attendance',
              'Shows interest in advanced meditation techniques',
              'Responds well to personalized communication'
            ],
            recommendations: [
              'Continue current approach',
              'Consider offering premium services',
              'Schedule follow-up within 1 week'
            ]
          })
        });
      });

      // Verify insights appear
      await expect(page.locator('[data-testid="ai-insights"]')).toBeVisible();
      await expect(page.locator('[data-testid="sentiment-score"]')).toContainText('4.2');
      await expect(page.locator('[data-testid="engagement-level"]')).toContainText('high');
      
      // Verify insights list
      const insightItems = page.locator('[data-testid="insight-item"]');
      await expect(insightItems).toHaveCount(3);
      
      // Verify recommendations
      const recommendationItems = page.locator('[data-testid="recommendation-item"]');
      await expect(recommendationItems).toHaveCount(3);
    });

    test('should handle AI service errors gracefully', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="contact-row"]').first().click();
      await page.locator('[data-testid="generate-insights-button"]').click();

      // Mock AI service error
      await page.route('**/api/ai/contacts/*/insights', route => {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'AI service temporarily unavailable'
          })
        });
      });

      // Should show error message
      await expect(page.locator('[data-testid="ai-error"]')).toBeVisible();
      await expect(page.locator('text=AI service temporarily unavailable')).toBeVisible();

      // Should offer retry option
      await expect(page.locator('[data-testid="retry-insights"]')).toBeVisible();
    });
  });

  test.describe('Mobile Responsive Design', () => {
    test('should work properly on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Mobile menu should be visible
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

      // Table should be responsive (possibly collapsed or scrollable)
      const contactsList = page.locator('[data-testid="contacts-mobile-list"]');
      if (await contactsList.isVisible()) {
        // Mobile list view
        await expect(contactsList).toBeVisible();
        await expect(page.locator('[data-testid="contact-card"]')).toHaveCount(3);
      } else {
        // Table should be horizontally scrollable
        const table = page.locator('[data-testid="contacts-table"]');
        await expect(table).toBeVisible();
        await expect(table).toHaveCSS('overflow-x', 'auto');
      }

      // Touch interactions should work
      await page.locator('[data-testid="contact-row"]').first().tap();
      await expect(page).toHaveURL(/\/contacts\/[^\/]+$/);
    });
  });

  test.describe('Accessibility', () => {
    test('should meet basic accessibility standards', async () => {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');

      // Check for proper heading structure
      await expect(page.locator('h1')).toBeVisible();
      
      // Check for proper form labels
      await page.locator('[data-testid="add-contact-button"]').click();
      await expect(page.locator('label[for="contact-name"]')).toBeVisible();
      await expect(page.locator('label[for="contact-email"]')).toBeVisible();

      // Check for ARIA attributes
      const searchInput = page.locator('[data-testid="contact-search"]');
      await expect(searchInput).toHaveAttribute('aria-label');

      // Check keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();

      // Check focus management in modals
      const nameInput = page.locator('[data-testid="contact-name-input"]');
      await expect(nameInput).toBeFocused();
    });
  });
});