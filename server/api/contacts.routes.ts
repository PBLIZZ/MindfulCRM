/// <reference types="node" />
import { Router, type Request, type Response } from 'express';
import type { Express } from 'express-serve-static-core';
import multer from 'multer';
import { z } from 'zod';
import fs from 'fs';

import { contactService } from '../services/contact.service.js';
import { requireAuth } from '../utils/jwt-auth.js';
import {
  apiRateLimit,
  csrfProtection,
  validateContactId,
  handleValidationErrors,
  validateFileUpload,
  uploadRateLimit,
} from '../utils/security.js';
import { createContactSchema, updateContactSchema } from '../schemas/contact.schemas.js';
import { nullsToUndefined } from '../utils/api-helpers.js';
import { sanitizeResponse } from '../utils/sanitizers.js';
import { isAuthenticatedUser } from '../utils/type-guards.js';
import { createErrorResponse, logError } from '../utils/error-handling.js';
import type { Tag } from '../../shared/schema.js';

// Type definitions for request bodies
interface TaggedRequest extends Request {
  body: {
    tags?: Tag[];
    [key: string]: unknown;
  };
}

interface ContactIdRequest extends Request {
  body: {
    contactId: string;
  };
}

interface BulkTagRequest extends Request {
  body: {
    contactIds: string[];
    tagId?: string;
    tagName?: string;
    tagColor?: string;
  };
}

interface BulkRemoveTagRequest extends Request {
  body: {
    contactIds: string[];
    tagId: string;
  };
}

const contactsRouter = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'temp/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// GET all contacts for the logged-in user
contactsRouter.get('/', apiRateLimit, requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedUser(req.user)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const contacts = await contactService.getContacts(req.user.id);
    const sanitizedContacts = contacts.map(nullsToUndefined);
    res.json(sanitizeResponse(sanitizedContacts));
  } catch (error: unknown) {
    logError('Failed to fetch contacts', error);
    res.status(500).json(createErrorResponse('Failed to fetch contacts', error, true));
  }
});

// GET a single contact by ID with details
contactsRouter.get(
  '/:id',
  apiRateLimit,
  requireAuth,
  validateContactId,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const contactDetails = await contactService.getContactDetails(req.params.id);
      if (!contactDetails) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      // CRITICAL SECURITY FIX: Validate contact ownership
      if (contactDetails.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const sanitizedDetails = sanitizeResponse(contactDetails);
      res.json(nullsToUndefined(sanitizedDetails));
    } catch (error: unknown) {
      logError('Failed to fetch contact details', error);
      res.status(500).json(createErrorResponse('Failed to fetch contact details', error, true));
    }
  }
);

// POST a new contact
contactsRouter.post(
  '/',
  apiRateLimit,
  csrfProtection,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const contactData = createContactSchema.parse(req.body);
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const contact = await contactService.createContact(req.user.id, contactData);
      const sanitizedContact = sanitizeResponse(contact);
      res.status(201).json(nullsToUndefined(sanitizedContact));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      logError('Contact creation error', error);
      res.status(500).json(createErrorResponse('Failed to create contact', error, true));
    }
  }
);

// PATCH an existing contact
contactsRouter.patch(
  '/:id',
  apiRateLimit,
  csrfProtection,
  requireAuth,
  validateContactId,
  handleValidationErrors,
  async (req: TaggedRequest, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // CRITICAL SECURITY FIX: Validate contact ownership before update
      const existingContact = await contactService.getContactDetails(req.params.id);
      if (!existingContact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      if (existingContact.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { tags, ...requestBody } = req.body;
      const contactData = updateContactSchema.parse(requestBody);

      // Transform tags to convert null to undefined at API boundary (per DATA_DOCTRINE.md)
      const transformedTags = tags?.map((tag: { id: string; name: string; color: string | null; createdAt: Date }) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color ?? undefined
      }));

      const updatedContact = await contactService.updateContact(req.params.id, contactData, transformedTags);
      const sanitizedContact = sanitizeResponse(updatedContact);
      res.json(nullsToUndefined(sanitizedContact));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      logError('Contact update error', error);
      res.status(500).json(createErrorResponse('Failed to update contact', error, true));
    }
  }
);

// DELETE a contact
contactsRouter.delete(
  '/:id',
  apiRateLimit,
  csrfProtection,
  requireAuth,
  validateContactId,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // CRITICAL SECURITY FIX: Validate contact ownership before deletion
      const existingContact = await contactService.getContactDetails(req.params.id);
      if (!existingContact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      if (existingContact.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const success = await contactService.deleteContact(req.params.id);
      if (success) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Contact not found' });
      }
    } catch (error: unknown) {
      logError('Failed to delete contact', error);
      res.status(500).json(createErrorResponse('Failed to delete contact', error, true));
    }
  }
);

// POST a photo for a contact
contactsRouter.post(
  '/upload-photo',
  uploadRateLimit,
  csrfProtection,
  requireAuth,
  upload.single('image'),
  validateFileUpload,
  async (req: ContactIdRequest, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }
      const { contactId } = req.body;
      if (!contactId) {
        return res.status(400).json({ error: 'Contact ID is required' });
      }

      // CRITICAL SECURITY FIX: Validate contact ownership before photo upload
      const existingContact = await contactService.getContactDetails(contactId);
      if (!existingContact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      if (existingContact.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await contactService.uploadPhoto(contactId, req.file);

      if (!result.success) {
        return res.status(result.status!).json({ error: result.error });
      }
      res.json(result);
    } catch (error: unknown) {
      logError('Photo upload error', error);
      if (req.file) {
        // Cleanup temp file on error
        fs.unlink(req.file.path, (err: Error | null) => {
          if (err) {
            logError('Failed to cleanup temp file', err);
          }
        });
      }
      res.status(500).json(createErrorResponse('Failed to upload photo', error, true));
    }
  }
);

// POST to add a tag to multiple contacts
contactsRouter.post(
  '/bulk/add-tag',
  apiRateLimit,
  csrfProtection,
  requireAuth,
  async (req: BulkTagRequest, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { contactIds, tagId, tagName, tagColor } = req.body;
      if (!contactIds || !Array.isArray(contactIds) || (!tagId && !tagName)) {
        return res
          .status(400)
          .json({ error: 'contactIds array and either tagId or tagName are required' });
      }

      // CRITICAL SECURITY FIX: Validate ownership of all contacts before bulk tag operation
      const userContacts = await contactService.getContacts(req.user.id);
      const userContactIds = new Set(userContacts.map((c) => c.id));
      const unauthorizedIds = contactIds.filter((id) => !userContactIds.has(id));

      if (unauthorizedIds.length > 0) {
        return res.status(403).json({
          error: 'Access denied: You can only modify your own contacts',
          unauthorizedContacts: unauthorizedIds,
        });
      }

      const result = await contactService.addTagToContacts(
        contactIds,
        tagId ?? '',
        tagName,
        tagColor
      );
      res.json(result);
    } catch (error: unknown) {
      logError('Bulk add tag error', error);
      res.status(500).json(createErrorResponse('Failed to add tag to contacts', error, true));
    }
  }
);

// POST to remove a tag from multiple contacts
contactsRouter.post(
  '/bulk/remove-tag',
  apiRateLimit,
  csrfProtection,
  requireAuth,
  async (req: BulkRemoveTagRequest, res: Response) => {
    try {
      if (!isAuthenticatedUser(req.user)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { contactIds, tagId } = req.body;
      if (!contactIds || !Array.isArray(contactIds) || !tagId) {
        return res.status(400).json({ error: 'contactIds array and tagId are required' });
      }

      // CRITICAL SECURITY FIX: Validate ownership of all contacts before bulk tag removal
      const userContacts = await contactService.getContacts(req.user.id);
      const userContactIds = new Set(userContacts.map((c) => c.id));
      const unauthorizedIds = contactIds.filter((id) => !userContactIds.has(id));

      if (unauthorizedIds.length > 0) {
        return res.status(403).json({
          error: 'Access denied: You can only modify your own contacts',
          unauthorizedContacts: unauthorizedIds,
        });
      }

      const success = await contactService.removeTagFromContacts(contactIds, tagId);
      res.json({ success });
    } catch (error: unknown) {
      logError('Bulk remove tag error', error);
      res.status(500).json(createErrorResponse('Failed to remove tag from contacts', error, true));
    }
  }
);

export default contactsRouter;
