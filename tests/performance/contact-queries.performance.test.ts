/**
 * Performance tests for Contact queries and operations
 * Tests for N+1 query problems, large dataset handling, and response times
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { ContactService } from '../../server/services/contact.service.js';
import { ContactData } from '../../server/data/contact.data.js';
import { storage } from '../../server/data/index.js';
import { 
  TEST_USERS, 
  PERFORMANCE_DATA, 
  createTestUser,
  cleanupTestDatabase 
} from '../fixtures/test-data.js';
import type { InsertContact } from '../../shared/schema.js';

describe('Contact Performance Tests', () => {
  let contactService: ContactService;
  let contactData: ContactData;
  let testUserId: string;

  beforeAll(async () => {
    contactService = new ContactService();
    contactData = new ContactData();
    
    // Create test user for performance tests
    const testUser = await createTestUser({
      email: 'performance.test@mindfulcrm.com',
      name: 'Performance Test User'
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestDatabase();
  });

  describe('Large Dataset Query Performance', () => {
    it('should handle 1000 contacts efficiently (< 500ms)', async () => {
      // Arrange - Create 1000 contacts
      console.log('Creating 1000 test contacts...');
      const contacts = PERFORMANCE_DATA.LARGE_CONTACT_LIST.map(contact => ({
        ...contact,
        userId: testUserId
      }));
      
      // Batch insert for efficiency
      const startInsert = performance.now();
      await Promise.all(
        contacts.map(contact => storage.contacts.create(contact))
      );
      const endInsert = performance.now();
      console.log(`Inserted 1000 contacts in ${(endInsert - startInsert).toFixed(2)}ms`);

      // Act - Query all contacts
      const startQuery = performance.now();
      const result = await contactService.getContacts(testUserId);
      const endQuery = performance.now();

      // Assert
      const queryTime = endQuery - startQuery;
      console.log(`Queried 1000 contacts in ${queryTime.toFixed(2)}ms`);
      
      expect(result).toHaveLength(1000);
      expect(queryTime).toBeLessThan(500); // Should complete in under 500ms
      
      // Verify no N+1 query issues by checking tags are loaded
      result.forEach(contact => {
        expect(contact).toHaveProperty('tags');
        expect(Array.isArray(contact.tags)).toBe(true);
      });
    });

    it('should optimize contact details retrieval with joins', async () => {
      // Arrange - Create contact with related data
      const contact = await storage.contacts.create({
        id: 'perf-contact-detail',
        userId: testUserId,
        name: 'Performance Test Contact',
        email: 'perf.detail@example.com',
        lifecycleStage: 'core_client',
        sentiment: 4,
        engagementTrend: 'improving',
        hasGdprConsent: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create multiple interactions, goals, and documents
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          storage.interactions.create({
            id: `perf-interaction-${i}`,
            userId: testUserId,
            contactId: contact.id,
            type: 'email',
            summary: `Performance test interaction ${i}`,
            content: `Content for interaction ${i}`,
            sentiment: 4,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        );
      }
      await Promise.all(promises);

      // Act - Retrieve contact details
      const startQuery = performance.now();
      const result = await contactService.getContactDetails(contact.id);
      const endQuery = performance.now();

      // Assert
      const queryTime = endQuery - startQuery;
      console.log(`Retrieved contact details with 50 interactions in ${queryTime.toFixed(2)}ms`);
      
      expect(result).not.toBeNull();
      expect(result!.interactions).toHaveLength(50);
      expect(queryTime).toBeLessThan(200); // Should complete in under 200ms
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should handle bulk tag operations efficiently', async () => {
      // Arrange - Create 100 contacts
      const contacts = await Promise.all(
        Array.from({ length: 100 }, (_, i) => 
          storage.contacts.create({
            id: `bulk-contact-${i}`,
            userId: testUserId,
            name: `Bulk Contact ${i}`,
            email: `bulk${i}@example.com`,
            lifecycleStage: 'curious',
            sentiment: 3,
            engagementTrend: 'stable',
            hasGdprConsent: true,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        )
      );

      const contactIds = contacts.map(c => c.id);

      // Act - Bulk add tag operation
      const startBulkAdd = performance.now();
      const result = await contactService.addTagToContacts(
        contactIds,
        '',
        'Bulk Performance Tag',
        '#FF0000'
      );
      const endBulkAdd = performance.now();

      // Assert
      const bulkAddTime = endBulkAdd - startBulkAdd;
      console.log(`Bulk added tag to 100 contacts in ${bulkAddTime.toFixed(2)}ms`);
      
      expect(result.success).toBe(true);
      expect(result.contactTags).toHaveLength(100);
      expect(bulkAddTime).toBeLessThan(300); // Should complete in under 300ms

      // Act - Bulk remove tag operation
      const startBulkRemove = performance.now();
      const removeResult = await contactService.removeTagFromContacts(
        contactIds,
        result.tagId
      );
      const endBulkRemove = performance.now();

      // Assert
      const bulkRemoveTime = endBulkRemove - startBulkRemove;
      console.log(`Bulk removed tag from 100 contacts in ${bulkRemoveTime.toFixed(2)}ms`);
      
      expect(removeResult).toBe(true);
      expect(bulkRemoveTime).toBeLessThan(200); // Should complete in under 200ms
    });
  });

  describe('Search and Filter Performance', () => {
    it('should handle filtered queries efficiently', async () => {
      // Arrange - Create contacts with various lifecycle stages
      const lifecycleStages = ['curious', 'new_client', 'core_client', 'inactive'] as const;
      const contacts = await Promise.all(
        Array.from({ length: 400 }, (_, i) => 
          storage.contacts.create({
            id: `filter-contact-${i}`,
            userId: testUserId,
            name: `Filter Contact ${i}`,
            email: `filter${i}@example.com`,
            lifecycleStage: lifecycleStages[i % lifecycleStages.length],
            sentiment: Math.floor(Math.random() * 5) + 1,
            engagementTrend: 'stable',
            hasGdprConsent: Math.random() > 0.3,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        )
      );

      // Act - Query with filters (simulated by getting all and filtering)
      const startFilter = performance.now();
      const allContacts = await contactService.getContacts(testUserId);
      
      // Simulate common filtering operations
      const coreClients = allContacts.filter(c => c.lifecycleStage === 'core_client');
      const highSentiment = allContacts.filter(c => c.sentiment >= 4);
      const consentedContacts = allContacts.filter(c => c.hasGdprConsent);
      
      const endFilter = performance.now();

      // Assert
      const filterTime = endFilter - startFilter;
      console.log(`Filtered 400 contacts in ${filterTime.toFixed(2)}ms`);
      
      expect(allContacts).toHaveLength(400);
      expect(coreClients.length).toBeGreaterThan(0);
      expect(highSentiment.length).toBeGreaterThan(0);
      expect(consentedContacts.length).toBeGreaterThan(0);
      expect(filterTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should handle large result sets without memory issues', async () => {
      // Arrange - Create a substantial dataset
      console.log('Creating 2000 contacts for memory test...');
      const contacts = Array.from({ length: 2000 }, (_, i) => ({
        id: `memory-contact-${i}`,
        userId: testUserId,
        name: `Memory Test Contact ${i}`,
        email: `memory${i}@example.com`,
        phone: `+1-555-${String(i).padStart(4, '0')}`,
        lifecycleStage: 'new_client' as const,
        sentiment: 3,
        engagementTrend: 'stable' as const,
        hasGdprConsent: true,
        extractedFields: {
          company: `Company ${i}`,
          jobTitle: `Position ${i}`,
          interests: ['meditation', 'wellness', 'mindfulness']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Batch insert
      await Promise.all(
        contacts.map(contact => storage.contacts.create(contact as InsertContact))
      );

      // Get initial memory usage
      const initialMemory = process.memoryUsage();

      // Act - Query large dataset multiple times
      const iterations = 5;
      const queryTimes = [];
      
      for (let i = 0; i < iterations; i++) {
        const startQuery = performance.now();
        const result = await contactService.getContacts(testUserId);
        const endQuery = performance.now();
        
        queryTimes.push(endQuery - startQuery);
        expect(result).toHaveLength(2000);
      }

      // Get final memory usage
      const finalMemory = process.memoryUsage();
      
      // Assert
      const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / iterations;
      console.log(`Average query time for 2000 contacts: ${avgQueryTime.toFixed(2)}ms`);
      
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      
      expect(avgQueryTime).toBeLessThan(1000); // Should average under 1 second
      expect(memoryIncrease).toBeLessThan(100); // Should not increase memory by more than 100MB
      
      // Performance should not degrade significantly across iterations
      const firstQuery = queryTimes[0];
      const lastQuery = queryTimes[queryTimes.length - 1];
      const performanceDegradation = (lastQuery - firstQuery) / firstQuery;
      expect(performanceDegradation).toBeLessThan(0.5); // Less than 50% degradation
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent read operations efficiently', async () => {
      // Arrange - Create moderate dataset
      const contacts = await Promise.all(
        Array.from({ length: 200 }, (_, i) => 
          storage.contacts.create({
            id: `concurrent-contact-${i}`,
            userId: testUserId,
            name: `Concurrent Contact ${i}`,
            email: `concurrent${i}@example.com`,
            lifecycleStage: 'new_client',
            sentiment: 4,
            engagementTrend: 'improving',
            hasGdprConsent: true,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        )
      );

      // Act - Simulate concurrent read operations
      const concurrentReads = 10;
      const promises = Array.from({ length: concurrentReads }, async (_, i) => {
        const startTime = performance.now();
        
        if (i % 3 === 0) {
          // List all contacts
          await contactService.getContacts(testUserId);
        } else if (i % 3 === 1) {
          // Get specific contact details
          await contactService.getContactDetails(contacts[i % contacts.length].id);
        } else {
          // Mixed operations
          await contactService.getContacts(testUserId);
          await contactService.getContactDetails(contacts[i % contacts.length].id);
        }
        
        return performance.now() - startTime;
      });

      const operationTimes = await Promise.all(promises);
      
      // Assert
      const maxTime = Math.max(...operationTimes);
      const avgTime = operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length;
      
      console.log(`Concurrent operations - Max: ${maxTime.toFixed(2)}ms, Avg: ${avgTime.toFixed(2)}ms`);
      
      expect(maxTime).toBeLessThan(2000); // No single operation should take more than 2 seconds
      expect(avgTime).toBeLessThan(500); // Average should be under 500ms
    });

    it('should handle mixed read/write operations safely', async () => {
      // Arrange
      const contacts = await Promise.all(
        Array.from({ length: 50 }, (_, i) => 
          storage.contacts.create({
            id: `mixed-contact-${i}`,
            userId: testUserId,
            name: `Mixed Contact ${i}`,
            email: `mixed${i}@example.com`,
            lifecycleStage: 'curious',
            sentiment: 3,
            engagementTrend: 'stable',
            hasGdprConsent: true,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        )
      );

      // Act - Mix of read and write operations
      const operations = [];
      
      for (let i = 0; i < 20; i++) {
        if (i % 4 === 0) {
          // Read operation
          operations.push(contactService.getContacts(testUserId));
        } else if (i % 4 === 1) {
          // Update operation
          const contact = contacts[i % contacts.length];
          operations.push(contactService.updateContact(contact.id, { sentiment: 4 }, undefined));
        } else if (i % 4 === 2) {
          // Create operation
          operations.push(contactService.createContact(testUserId, {
            name: `New Contact ${i}`,
            email: `new${i}@example.com`,
            lifecycleStage: 'curious',
            sentiment: 3,
            engagementTrend: 'stable',
            hasGdprConsent: true
          }));
        } else {
          // Detail read
          const contact = contacts[i % contacts.length];
          operations.push(contactService.getContactDetails(contact.id));
        }
      }

      const startTime = performance.now();
      const results = await Promise.all(operations);
      const endTime = performance.now();

      // Assert
      const totalTime = endTime - startTime;
      console.log(`Mixed operations completed in ${totalTime.toFixed(2)}ms`);
      
      expect(results).toHaveLength(20);
      expect(totalTime).toBeLessThan(3000); // Should complete in under 3 seconds
      
      // Verify no operations failed
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
      });
    });
  });

  describe('Database Index Effectiveness', () => {
    it('should demonstrate index usage for common queries', async () => {
      // This test would ideally use EXPLAIN ANALYZE in a real database
      // For now, we'll test query performance patterns that indicate proper indexing
      
      // Arrange - Create contacts with varied data for index testing
      const contacts = await Promise.all(
        Array.from({ length: 1000 }, (_, i) => 
          storage.contacts.create({
            id: `index-contact-${i}`,
            userId: testUserId,
            name: `Index Contact ${i}`,
            email: `index${i}@example.com`,
            lifecycleStage: i % 2 === 0 ? 'core_client' : 'curious',
            sentiment: (i % 5) + 1,
            engagementTrend: 'stable',
            hasGdprConsent: i % 3 !== 0,
            lastContact: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Spread over days
            createdAt: new Date(Date.now() - (i * 60 * 60 * 1000)), // Spread over hours
            updatedAt: new Date()
          })
        )
      );

      // Test queries that should benefit from indexes
      const queries = [
        // Query by userId (should be very fast with index)
        () => contactService.getContacts(testUserId),
        
        // Query by specific contact ID (should be instant with primary key)
        () => contactService.getContactDetails(contacts[0].id),
        
        // Multiple contact lookups (should benefit from batching/caching)
        () => Promise.all(
          contacts.slice(0, 10).map(c => contactService.getContactDetails(c.id))
        )
      ];

      // Act & Assert
      for (const [index, query] of queries.entries()) {
        const startTime = performance.now();
        const result = await query();
        const endTime = performance.now();
        
        const queryTime = endTime - startTime;
        console.log(`Index test query ${index + 1}: ${queryTime.toFixed(2)}ms`);
        
        expect(result).toBeDefined();
        expect(queryTime).toBeLessThan(100); // Well-indexed queries should be very fast
      }
    });
  });
});