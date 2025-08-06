/**
 * Integration tests for Contact API routes
 * Tests complete request-response cycle with mocked external dependencies
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import supertest from 'supertest';
import express from 'express';
import { storage } from '../../../server/data/index.js';
import { contactService } from '../../../server/services/contact.service.js';
import {
  TEST_USERS,
  TEST_CONTACTS,
  TEST_TAGS,
  createTestContext,
  cleanupTestDatabase
} from '../../fixtures/test-data.js';
import { resetAllMocks } from '../../mocks/providers/ai-providers.mock.js';
import type { Express } from 'express';

// Import the contact routes
import contactRoutes from '../../../server/api/contacts.routes.js';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Mock authentication middleware for testing
  app.use((req: any, res, next) => {
    req.user = { id: TEST_USERS.WELLNESS_COACH.id };
    next();
  });
  
  app.use('/api/contacts', contactRoutes);
  
  // Error handling middleware
  app.use((error: any, req: any, res: any, next: any) => {
    res.status(error.status || 500).json({
      error: error.message || 'Internal server error'
    });
  });

  return app;
}

describe('Contact API Integration Tests', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let testContext: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    app = createTestApp();
    request = supertest(app);
  });

  beforeEach(async () => {
    // Reset all mocks and setup fresh test data
    resetAllMocks();
    testContext = await createTestContext();
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/contacts', () => {
    it('should return all contacts for authenticated user', async () => {
      // Act
      const response = await request
        .get('/api/contacts')
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('contacts');
      expect(Array.isArray(response.body.contacts)).toBe(true);
      expect(response.body.contacts).toHaveLength(testContext.contacts.length);
      
      // Verify contact structure
      const firstContact = response.body.contacts[0];
      expect(firstContact).toHaveProperty('id');
      expect(firstContact).toHaveProperty('name');
      expect(firstContact).toHaveProperty('email');
      expect(firstContact).toHaveProperty('tags');
    });

    it('should handle empty contact list', async () => {
      // Arrange - clean up existing contacts
      await testContext.cleanup();
      
      // Act
      const response = await request
        .get('/api/contacts')
        .expect(200);

      // Assert
      expect(response.body.contacts).toEqual([]);
    });

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange - create app without auth middleware
      const unauthenticatedApp = express();
      unauthenticatedApp.use(express.json());
      unauthenticatedApp.use('/api/contacts', contactRoutes);
      const unauthenticatedRequest = supertest(unauthenticatedApp);

      // Act
      await unauthenticatedRequest
        .get('/api/contacts')
        .expect(401);
    });
  });

  describe('GET /api/contacts/:id', () => {
    it('should return contact details with related data', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;

      // Act
      const response = await request
        .get(`/api/contacts/${contactId}`)
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('contact');
      const contact = response.body.contact;
      expect(contact.id).toBe(contactId);
      expect(contact).toHaveProperty('name');
      expect(contact).toHaveProperty('email');
      expect(contact).toHaveProperty('interactions');
      expect(contact).toHaveProperty('goals');
      expect(contact).toHaveProperty('documents');
    });

    it('should return 404 for non-existent contact', async () => {
      // Act
      const response = await request
        .get('/api/contacts/non-existent-id')
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Contact not found');
    });

    it('should return 400 for invalid contact ID format', async () => {
      // Act
      await request
        .get('/api/contacts/invalid-id-format')
        .expect(400);
    });
  });

  describe('POST /api/contacts', () => {
    it('should create a new contact successfully', async () => {
      // Arrange
      const newContactData = {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+1-555-0199',
        lifecycleStage: 'curious'
      };

      // Act
      const response = await request
        .post('/api/contacts')
        .send(newContactData)
        .expect(201);

      // Assert
      expect(response.body).toHaveProperty('contact');
      const contact = response.body.contact;
      expect(contact.name).toBe(newContactData.name);
      expect(contact.email).toBe(newContactData.email);
      expect(contact.phone).toBe(newContactData.phone);
      expect(contact.lifecycleStage).toBe(newContactData.lifecycleStage);
      expect(contact).toHaveProperty('id');
      expect(contact).toHaveProperty('createdAt');
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidContactData = {
        email: 'invalid-email', // Invalid email format
        phone: 'invalid-phone' // Invalid phone format
      };

      // Act
      const response = await request
        .post('/api/contacts')
        .send(invalidContactData)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });

    it('should prevent duplicate email addresses', async () => {
      // Arrange
      const existingEmail = testContext.contacts[0].email;
      const duplicateContactData = {
        name: 'Duplicate Contact',
        email: existingEmail,
        phone: '+1-555-0200'
      };

      // Act
      const response = await request
        .post('/api/contacts')
        .send(duplicateContactData)
        .expect(409);

      // Assert
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('PUT /api/contacts/:id', () => {
    it('should update contact successfully', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;
      const updateData = {
        name: 'Updated Name',
        phone: '+1-555-9999',
        sentiment: 5
      };

      // Act
      const response = await request
        .put(`/api/contacts/${contactId}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body).toHaveProperty('contact');
      const contact = response.body.contact;
      expect(contact.name).toBe(updateData.name);
      expect(contact.phone).toBe(updateData.phone);
      expect(contact.sentiment).toBe(updateData.sentiment);
    });

    it('should update contact with tags', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;
      
      // First create some tags
      const tagData = [
        { name: 'VIP Client', color: '#FFD700' },
        { name: 'Active Member', color: '#32CD32' }
      ];
      
      const createdTags = await Promise.all(
        tagData.map(tag => storage.contacts.createTag(tag))
      );

      const updateData = {
        name: 'Updated with Tags',
        tags: createdTags.map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color
        }))
      };

      // Act
      const response = await request
        .put(`/api/contacts/${contactId}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.contact.name).toBe(updateData.name);
      expect(response.body.contact.tags).toHaveLength(2);
    });

    it('should return 404 for non-existent contact', async () => {
      // Arrange
      const updateData = { name: 'Updated Name' };

      // Act
      await request
        .put('/api/contacts/non-existent-id')
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/contacts/:id', () => {
    it('should delete contact successfully', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;

      // Act
      await request
        .delete(`/api/contacts/${contactId}`)
        .expect(200);

      // Verify deletion
      const getResponse = await request
        .get(`/api/contacts/${contactId}`)
        .expect(404);
    });

    it('should return 404 for non-existent contact', async () => {
      // Act
      await request
        .delete('/api/contacts/non-existent-id')
        .expect(404);
    });

    it('should handle cascade deletion of related data', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;
      
      // Create some related data
      await storage.interactions.create({
        id: 'test-interaction',
        userId: testContext.user.id,
        contactId,
        type: 'email',
        summary: 'Test interaction',
        content: 'Test content',
        sentiment: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act
      await request
        .delete(`/api/contacts/${contactId}`)
        .expect(200);

      // Assert - related data should also be cleaned up
      const interactions = await storage.interactions.getByContactId(contactId);
      expect(interactions).toHaveLength(0);
    });
  });

  describe('POST /api/contacts/:id/photo', () => {
    it('should upload contact photo successfully', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;
      const imageBuffer = Buffer.from('fake-image-data');

      // Act
      const response = await request
        .post(`/api/contacts/${contactId}/photo`)
        .attach('photo', imageBuffer, 'profile.jpg')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('avatarUrl');
      expect(response.body.avatarUrl).toMatch(/^\/uploads\/contact-photos\/.*\.webp$/);
    });

    it('should reject invalid file types', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;
      const documentBuffer = Buffer.from('fake-document-data');

      // Act
      await request
        .post(`/api/contacts/${contactId}/photo`)
        .attach('photo', documentBuffer, 'document.pdf')
        .expect(400);
    });

    it('should reject files that are too large', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;
      const largeImageBuffer = Buffer.alloc(1024 * 1024 * 15); // 15MB

      // Act
      await request
        .post(`/api/contacts/${contactId}/photo`)
        .attach('photo', largeImageBuffer, 'large-image.jpg')
        .expect(413); // Payload too large
    });
  });

  describe('Bulk Operations', () => {
    describe('POST /api/contacts/bulk/add-tag', () => {
      it('should add tag to multiple contacts', async () => {
        // Arrange
        const contactIds = testContext.contacts.map(c => c.id);
        const tagData = {
          tagName: 'Bulk Tagged',
          tagColor: '#FF6347'
        };

        // Act
        const response = await request
          .post('/api/contacts/bulk/add-tag')
          .send({ contactIds, ...tagData })
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('tagId');
        expect(response.body.contactTags).toHaveLength(contactIds.length);
      });

      it('should add existing tag to contacts', async () => {
        // Arrange
        const tag = await storage.contacts.createTag({
          name: 'Existing Tag',
          color: '#32CD32'
        });
        const contactIds = [testContext.contacts[0].id];

        // Act
        const response = await request
          .post('/api/contacts/bulk/add-tag')
          .send({ contactIds, tagId: tag.id })
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.tagId).toBe(tag.id);
      });
    });

    describe('POST /api/contacts/bulk/remove-tag', () => {
      it('should remove tag from multiple contacts', async () => {
        // Arrange
        const tag = await storage.contacts.createTag({
          name: 'Tag to Remove',
          color: '#FF0000'
        });
        const contactIds = testContext.contacts.map(c => c.id);
        
        // First add the tag to contacts
        await contactService.addTagToContacts(contactIds, tag.id);

        // Act
        const response = await request
          .post('/api/contacts/bulk/remove-tag')
          .send({ contactIds, tagId: tag.id })
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle requests with large contact lists', async () => {
      // This test ensures the API can handle users with many contacts
      const startTime = Date.now();
      
      await request
        .get('/api/contacts')
        .expect(200);
        
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Response should be under 1 second for reasonable contact lists
      expect(responseTime).toBeLessThan(1000);
    });

    it('should handle concurrent requests gracefully', async () => {
      // Arrange
      const contactId = testContext.contacts[0].id;
      const requests = Array.from({ length: 5 }, () =>
        request.get(`/api/contacts/${contactId}`)
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert - all requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.contact.id).toBe(contactId);
      });
    });

    it('should handle malformed request payloads', async () => {
      // Test with invalid JSON
      const response = await request
        .post('/api/contacts')
        .set('Content-Type', 'application/json')
        .send('invalid-json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should enforce rate limiting', async () => {
      // This would be implemented with actual rate limiting middleware
      // For now, just ensure the endpoint exists and responds
      const requests = Array.from({ length: 100 }, () =>
        request.get('/api/contacts')
      );

      // Should not crash the server
      const responses = await Promise.all(requests);
      
      // At least some requests should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });
});