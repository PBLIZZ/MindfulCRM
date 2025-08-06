/**
 * Unit tests for ContactService
 * Tests business logic, error handling, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ContactService } from '../../../server/services/contact.service.js';
import { storage } from '../../../server/data/index.js';
import { safeFileOperation } from '../../../server/utils/security.js';
import { TEST_CONTACTS, TEST_USERS, TEST_TAGS, TEST_FILE_UPLOADS, getTestData } from '../../fixtures/test-data.js';
import { mockFs, mockSharp } from '../../mocks/providers/ai-providers.mock.js';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

// Mock external dependencies
jest.mock('../../../server/data/index.js');
jest.mock('../../../server/utils/security.js');
jest.mock('fs');
jest.mock('sharp');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockSafeFileOperation = safeFileOperation as jest.MockedFunction<typeof safeFileOperation>;

describe('ContactService', () => {
  let contactService: ContactService;

  beforeEach(() => {
    contactService = new ContactService();
    jest.clearAllMocks();

    // Setup default mocks
    mockSafeFileOperation.mockReturnValue(true);
    (fs.existsSync as jest.MockedFunction<typeof fs.existsSync>).mockReturnValue(true);
    (fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>).mockImplementation();
    (fs.unlinkSync as jest.MockedFunction<typeof fs.unlinkSync>).mockImplementation();
    (fs.statSync as jest.MockedFunction<typeof fs.statSync>).mockReturnValue({ size: 1024 } as any);
    (sharp as jest.MockedFunction<typeof sharp>).mockImplementation(() => mockSharp as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getContacts', () => {
    it('should return contacts for a valid user ID', async () => {
      // Arrange
      const userId = TEST_USERS.WELLNESS_COACH.id;
      const expectedContacts = [
        { ...TEST_CONTACTS.ENGAGED_CLIENT, tags: [] },
        { ...TEST_CONTACTS.NEW_CLIENT, tags: [] }
      ];
      mockStorage.contacts.getByUserId.mockResolvedValue(expectedContacts);

      // Act
      const result = await contactService.getContacts(userId);

      // Assert
      expect(result).toEqual(expectedContacts);
      expect(mockStorage.contacts.getByUserId).toHaveBeenCalledWith(userId);
      expect(mockStorage.contacts.getByUserId).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when user has no contacts', async () => {
      // Arrange
      const userId = 'user-with-no-contacts';
      mockStorage.contacts.getByUserId.mockResolvedValue([]);

      // Act
      const result = await contactService.getContacts(userId);

      // Assert
      expect(result).toEqual([]);
      expect(mockStorage.contacts.getByUserId).toHaveBeenCalledWith(userId);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const userId = TEST_USERS.WELLNESS_COACH.id;
      const dbError = new Error('Database connection failed');
      mockStorage.contacts.getByUserId.mockRejectedValue(dbError);

      // Act & Assert
      await expect(contactService.getContacts(userId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getContactDetails', () => {
    it('should return contact with related data', async () => {
      // Arrange
      const contactId = TEST_CONTACTS.ENGAGED_CLIENT.id;
      const mockContact = { ...TEST_CONTACTS.ENGAGED_CLIENT, tags: [] };
      const mockInteractions = [{ id: 'interaction-1', contactId, type: 'email' }];
      const mockGoals = [{ id: 'goal-1', contactId, title: 'Learn meditation' }];
      const mockDocuments = [{ id: 'doc-1', contactId, fileName: 'notes.pdf' }];

      mockStorage.contacts.getById.mockResolvedValue(mockContact);
      mockStorage.interactions.getByContactId.mockResolvedValue(mockInteractions as any);
      mockStorage.interactions.getGoalsByContactId.mockResolvedValue(mockGoals as any);
      mockStorage.misc.getDocumentsByContactId.mockResolvedValue(mockDocuments as any);

      // Act
      const result = await contactService.getContactDetails(contactId);

      // Assert
      expect(result).toEqual({
        ...mockContact,
        interactions: mockInteractions,
        goals: mockGoals,
        documents: mockDocuments
      });
      expect(mockStorage.contacts.getById).toHaveBeenCalledWith(contactId);
    });

    it('should return null for non-existent contact', async () => {
      // Arrange
      const contactId = 'non-existent-contact';
      mockStorage.contacts.getById.mockResolvedValue(undefined);

      // Act
      const result = await contactService.getContactDetails(contactId);

      // Assert
      expect(result).toBeNull();
      expect(mockStorage.contacts.getById).toHaveBeenCalledWith(contactId);
      // Should not call related data fetches
      expect(mockStorage.interactions.getByContactId).not.toHaveBeenCalled();
    });
  });

  describe('createContact', () => {
    it('should create a new contact successfully', async () => {
      // Arrange
      const userId = TEST_USERS.WELLNESS_COACH.id;
      const contactData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0199'
      };
      const expectedContact = {
        id: 'new-contact-id',
        ...contactData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockStorage.contacts.create.mockResolvedValue(expectedContact as any);

      // Act
      const result = await contactService.createContact(userId, contactData);

      // Assert
      expect(result).toEqual(expectedContact);
      expect(mockStorage.contacts.create).toHaveBeenCalledWith({ ...contactData, userId });
    });

    it('should handle validation errors', async () => {
      // Arrange
      const userId = TEST_USERS.WELLNESS_COACH.id;
      const invalidContactData = { name: '', email: 'invalid-email' }; // Invalid data
      const validationError = new Error('Validation failed');
      mockStorage.contacts.create.mockRejectedValue(validationError);

      // Act & Assert
      await expect(
        contactService.createContact(userId, invalidContactData as any)
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('updateContact', () => {
    it('should update contact and manage tags successfully', async () => {
      // Arrange
      const contactId = TEST_CONTACTS.ENGAGED_CLIENT.id;
      const updates = { name: 'Updated Name', phone: '+1-555-9999' };
      const newTags = [
        { id: TEST_TAGS.VIP_CLIENT.id, name: TEST_TAGS.VIP_CLIENT.name, color: TEST_TAGS.VIP_CLIENT.color },
        { id: 'temp_new_tag', name: 'New Tag', color: '#FF0000' }
      ];

      const currentContact = { ...TEST_CONTACTS.ENGAGED_CLIENT, tags: [] };
      const existingTags = [TEST_TAGS.VIP_CLIENT];
      const createdTag = { id: 'created-tag-id', name: 'New Tag', color: '#FF0000' };
      const updatedContact = { ...currentContact, ...updates, tags: [TEST_TAGS.VIP_CLIENT, createdTag] };

      mockStorage.contacts.update.mockResolvedValue(updatedContact as any);
      mockStorage.contacts.getById
        .mockResolvedValueOnce(currentContact as any) // First call for current tags
        .mockResolvedValueOnce(updatedContact as any); // Second call for final result
      mockStorage.contacts.getAllTags.mockResolvedValue(existingTags as any);
      mockStorage.contacts.createTag.mockResolvedValue(createdTag as any);
      mockStorage.contacts.addTag.mockResolvedValue({ contactId, tagId: TEST_TAGS.VIP_CLIENT.id } as any);

      // Act
      const result = await contactService.updateContact(contactId, updates, newTags);

      // Assert
      expect(result).toEqual(updatedContact);
      expect(mockStorage.contacts.update).toHaveBeenCalledWith(contactId, updates);
      expect(mockStorage.contacts.createTag).toHaveBeenCalledWith({
        name: 'New Tag',
        color: '#FF0000'
      });
      expect(mockStorage.contacts.addTag).toHaveBeenCalledTimes(2);
    });

    it('should handle update without tags', async () => {
      // Arrange
      const contactId = TEST_CONTACTS.NEW_CLIENT.id;
      const updates = { sentiment: 5 };
      const updatedContact = { ...TEST_CONTACTS.NEW_CLIENT, ...updates, tags: [] };

      mockStorage.contacts.update.mockResolvedValue(updatedContact as any);
      mockStorage.contacts.getById.mockResolvedValue(updatedContact as any);

      // Act
      const result = await contactService.updateContact(contactId, updates, undefined);

      // Assert
      expect(result).toEqual(updatedContact);
      expect(mockStorage.contacts.update).toHaveBeenCalledWith(contactId, updates);
      // Should not attempt tag operations
      expect(mockStorage.contacts.getAllTags).not.toHaveBeenCalled();
    });

    it('should throw error if updated contact not found', async () => {
      // Arrange
      const contactId = 'non-existent';
      const updates = { name: 'Updated Name' };

      mockStorage.contacts.update.mockResolvedValue({} as any);
      mockStorage.contacts.getById.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        contactService.updateContact(contactId, updates, undefined)
      ).rejects.toThrow('Failed to retrieve updated contact');
    });
  });

  describe('deleteContact', () => {
    it('should delete contact successfully', async () => {
      // Arrange
      const contactId = TEST_CONTACTS.CURIOUS_PROSPECT.id;
      mockStorage.contacts.delete.mockResolvedValue(true);

      // Act
      const result = await contactService.deleteContact(contactId);

      // Assert
      expect(result).toBe(true);
      expect(mockStorage.contacts.delete).toHaveBeenCalledWith(contactId);
    });

    it('should return false for non-existent contact', async () => {
      // Arrange
      const contactId = 'non-existent';
      mockStorage.contacts.delete.mockResolvedValue(false);

      // Act
      const result = await contactService.deleteContact(contactId);

      // Assert
      expect(result).toBe(false);
      expect(mockStorage.contacts.delete).toHaveBeenCalledWith(contactId);
    });
  });

  describe('uploadPhoto', () => {
    beforeEach(() => {
      // Setup upload directory mock
      (fs.existsSync as jest.MockedFunction<typeof fs.existsSync>).mockReturnValue(true);
    });

    it('should upload and process photo successfully', async () => {
      // Arrange
      const contactId = TEST_CONTACTS.NEW_CLIENT.id;
      const file = getTestData(TEST_FILE_UPLOADS.VALID_IMAGE);
      const contact = { ...TEST_CONTACTS.NEW_CLIENT, tags: [] };
      const photoRecord = {
        id: 'photo-123',
        contactId,
        fileName: expect.stringMatching(/\.webp$/),
        filePath: expect.stringMatching(/^\/uploads\/contact-photos\/.*\.webp$/),
        fileSize: 1024,
        mimeType: 'image/webp',
        source: 'manual',
        isActive: true
      };

      mockStorage.contacts.getById.mockResolvedValue(contact as any);
      mockStorage.contacts.createPhoto.mockResolvedValue(photoRecord as any);
      mockStorage.contacts.update.mockResolvedValue(contact as any);

      // Act
      const result = await contactService.uploadPhoto(contactId, file);

      // Assert
      expect(result.success).toBe(true);
      expect(result.avatarUrl).toMatch(/^\/uploads\/contact-photos\/.*\.webp$/);
      expect(result.photoId).toBe('photo-123');
      expect(result.fileSize).toBe(1024);

      expect(mockSharp.resize).toHaveBeenCalledWith(400, 400, { fit: 'cover', position: 'center' });
      expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 85 });
      expect(mockStorage.contacts.createPhoto).toHaveBeenCalled();
      expect(mockStorage.contacts.update).toHaveBeenCalledWith(contactId, expect.objectContaining({
        avatarUrl: expect.stringMatching(/^\/uploads\/contact-photos\/.*\.webp$/)
      }));
    });

    it('should return error for non-existent contact', async () => {
      // Arrange
      const contactId = 'non-existent';
      const file = getTestData(TEST_FILE_UPLOADS.VALID_IMAGE);

      mockStorage.contacts.getById.mockResolvedValue(undefined);

      // Act
      const result = await contactService.uploadPhoto(contactId, file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Contact not found');
      expect(result.status).toBe(404);
      expect(fs.unlinkSync).toHaveBeenCalledWith(file.path);
    });

    it('should handle file path security validation', async () => {
      // Arrange
      const contactId = TEST_CONTACTS.NEW_CLIENT.id;
      const file = getTestData(TEST_FILE_UPLOADS.VALID_IMAGE);
      const contact = { ...TEST_CONTACTS.NEW_CLIENT, tags: [] };

      mockStorage.contacts.getById.mockResolvedValue(contact as any);
      mockSafeFileOperation
        .mockReturnValueOnce(true) // temp file cleanup
        .mockReturnValueOnce(false); // output path validation fails

      // Act
      const result = await contactService.uploadPhoto(contactId, file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid file path');
      expect(result.status).toBe(400);
      expect(fs.unlinkSync).toHaveBeenCalledWith(file.path);
    });

    it('should handle image processing errors', async () => {
      // Arrange
      const contactId = TEST_CONTACTS.NEW_CLIENT.id;
      const file = getTestData(TEST_FILE_UPLOADS.VALID_IMAGE);
      const contact = { ...TEST_CONTACTS.NEW_CLIENT, tags: [] };
      const processingError = new Error('Image processing failed');

      mockStorage.contacts.getById.mockResolvedValue(contact as any);
      mockSharp.toFile.mockRejectedValue(processingError);

      // Act & Assert
      await expect(
        contactService.uploadPhoto(contactId, file)
      ).rejects.toThrow('Image processing failed');
      expect(fs.unlinkSync).toHaveBeenCalledWith(file.path);
    });
  });

  describe('addTagToContacts', () => {
    it('should add existing tag to multiple contacts', async () => {
      // Arrange
      const contactIds = [TEST_CONTACTS.ENGAGED_CLIENT.id, TEST_CONTACTS.NEW_CLIENT.id];
      const tagId = TEST_TAGS.VIP_CLIENT.id;
      const mockContactTags = contactIds.map(contactId => ({ contactId, tagId }));

      mockStorage.contacts.addTagToMultiple.mockResolvedValue(mockContactTags as any);

      // Act
      const result = await contactService.addTagToContacts(contactIds, tagId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tagId).toBe(tagId);
      expect(result.contactTags).toEqual(mockContactTags);
      expect(mockStorage.contacts.addTagToMultiple).toHaveBeenCalledWith(contactIds, tagId);
    });

    it('should create new tag and add to contacts', async () => {
      // Arrange
      const contactIds = [TEST_CONTACTS.ENGAGED_CLIENT.id];
      const tagName = 'Premium Client';
      const tagColor = '#GOLD';
      const createdTag = { id: 'new-tag-id', name: tagName, color: tagColor };
      const mockContactTags = [{ contactId: contactIds[0], tagId: createdTag.id }];

      mockStorage.contacts.createTag.mockResolvedValue(createdTag as any);
      mockStorage.contacts.addTagToMultiple.mockResolvedValue(mockContactTags as any);

      // Act
      const result = await contactService.addTagToContacts(contactIds, '', tagName, tagColor);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tagId).toBe(createdTag.id);
      expect(mockStorage.contacts.createTag).toHaveBeenCalledWith({
        name: tagName,
        color: tagColor
      });
      expect(mockStorage.contacts.addTagToMultiple).toHaveBeenCalledWith(contactIds, createdTag.id);
    });

    it('should throw error when no tag ID or name provided', async () => {
      // Arrange
      const contactIds = [TEST_CONTACTS.ENGAGED_CLIENT.id];

      // Act & Assert
      await expect(
        contactService.addTagToContacts(contactIds, '', undefined)
      ).rejects.toThrow('Tag ID or tag name is required');
    });
  });

  describe('removeTagFromContacts', () => {
    it('should remove tag from multiple contacts', async () => {
      // Arrange
      const contactIds = [TEST_CONTACTS.ENGAGED_CLIENT.id, TEST_CONTACTS.NEW_CLIENT.id];
      const tagId = TEST_TAGS.NEEDS_FOLLOWUP.id;

      mockStorage.contacts.removeTagFromMultiple.mockResolvedValue(true);

      // Act
      const result = await contactService.removeTagFromContacts(contactIds, tagId);

      // Assert
      expect(result).toBe(true);
      expect(mockStorage.contacts.removeTagFromMultiple).toHaveBeenCalledWith(contactIds, tagId);
    });

    it('should handle removal failure gracefully', async () => {
      // Arrange
      const contactIds = ['non-existent-contact'];
      const tagId = TEST_TAGS.NEEDS_FOLLOWUP.id;

      mockStorage.contacts.removeTagFromMultiple.mockResolvedValue(false);

      // Act
      const result = await contactService.removeTagFromContacts(contactIds, tagId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle concurrent tag operations', async () => {
      // This test ensures the service can handle simultaneous tag operations
      const contactId = TEST_CONTACTS.ENGAGED_CLIENT.id;
      const updates = { name: 'Updated Name' };
      const tags1 = [{ id: TEST_TAGS.VIP_CLIENT.id, name: 'VIP', color: '#GOLD' }];
      const tags2 = [{ id: TEST_TAGS.NEW_MEMBER.id, name: 'New', color: '#GREEN' }];

      const currentContact = { ...TEST_CONTACTS.ENGAGED_CLIENT, tags: [] };
      mockStorage.contacts.getById.mockResolvedValue(currentContact as any);
      mockStorage.contacts.update.mockResolvedValue(currentContact as any);

      // Act - simulate concurrent tag updates
      const [result1, result2] = await Promise.all([
        contactService.updateContact(contactId, updates, tags1),
        contactService.updateContact(contactId, updates, tags2)
      ]);

      // Assert - both operations should complete
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should handle large file uploads within limits', async () => {
      // Arrange
      const contactId = TEST_CONTACTS.NEW_CLIENT.id;
      const largeFile = {
        ...getTestData(TEST_FILE_UPLOADS.LARGE_IMAGE),
        size: 1024 * 1024 * 5 // 5MB file
      };
      const contact = { ...TEST_CONTACTS.NEW_CLIENT, tags: [] };

      mockStorage.contacts.getById.mockResolvedValue(contact as any);
      mockStorage.contacts.createPhoto.mockResolvedValue({} as any);
      mockStorage.contacts.update.mockResolvedValue(contact as any);

      // Act
      const result = await contactService.uploadPhoto(contactId, largeFile);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSharp.resize).toHaveBeenCalledWith(400, 400, { fit: 'cover', position: 'center' });
    });
  });
});
