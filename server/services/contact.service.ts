import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import type { Express } from 'express';
/// <reference types="multer" />
import { storage } from '../data/index.js';
import {
  type Contact,
  type InsertContact,
  type Tag,
  type ContactTag,
  type Interaction,
  type Goal,
  type Document,
} from '../../shared/schema.js';
import { safeFileOperation } from '../utils/security.js';

const uploadDir = path.join(process.cwd(), 'uploads', 'contact-photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export class ContactService {
  async getContacts(userId: string): Promise<Contact[]> {
    return storage.contacts.getByUserId(userId);
  }

  async getContactDetails(contactId: string): Promise<
    | (Contact & {
        interactions: Interaction[];
        goals: Goal[];
        documents: Document[];
      })
    | null
  > {
    const contact = await storage.contacts.getById(contactId);
    if (!contact) {
      return null;
    }

    const [interactions, goals, documents] = await Promise.all([
      storage.interactions.getByContactId(contactId),
      storage.interactions.getGoalsByContactId(contactId),
      storage.misc.getDocumentsByContactId(contactId),
    ]);

    return {
      ...contact,
      interactions,
      goals,
      documents,
    };
  }

  async createContact(
    userId: string,
    contactData: Omit<InsertContact, 'userId'>
  ): Promise<Contact> {
    return storage.contacts.create({ ...contactData, userId });
  }

  async updateContact(
    contactId: string,
    contactData: Partial<InsertContact>,
    tags: { id: string; name: string; color?: string }[] | undefined
  ): Promise<Contact & { tags: Tag[] }> {
    await storage.contacts.update(contactId, contactData);

    if (tags && Array.isArray(tags)) {
      const currentContact = await storage.contacts.getById(contactId);
      const currentTags = currentContact?.tags ?? [];

      const newTagIds = new Set(tags.map((t) => t.id));
      const oldTagIds = new Set(currentTags.map((t) => t.id));

      for (const oldTag of currentTags) {
        if (!newTagIds.has(oldTag.id)) {
          await storage.contacts.removeTag(contactId, oldTag.id);
        }
      }

      const existingTags = await storage.contacts.getAllTags();
      for (const newTag of tags) {
        if (oldTagIds.has(newTag.id)) continue;

        let tagId = newTag.id;
        if (newTag.id.startsWith('temp_')) {
          const existingTag = existingTags.find(
            (t) => t.name.toLowerCase() === newTag.name.toLowerCase()
          );
          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const created = await storage.contacts.createTag({
              name: newTag.name,
              color: newTag.color ?? '#3b82f6',
            });
            tagId = created.id;
          }
        }
        await storage.contacts.addTag(contactId, tagId);
      }
    }

    const updatedContact = await storage.contacts.getById(contactId);
    if (!updatedContact) throw new Error('Failed to retrieve updated contact');
    return updatedContact;
  }

  async deleteContact(contactId: string): Promise<boolean> {
    return storage.contacts.delete(contactId);
  }

  async uploadPhoto(
    contactId: string,
    file: Express.Multer.File
  ): Promise<{
    success: boolean;
    error?: string;
    status?: number;
    avatarUrl?: string;
    photoId?: string;
    fileSize?: number;
  }> {
    const contact = await storage.contacts.getById(contactId);
    if (!contact) {
      if (safeFileOperation(file.path, 'temp/')) {
        fs.unlinkSync(file.path);
      }
      return { success: false, error: 'Contact not found', status: 404 };
    }

    const safeContactId = contactId.replace(/[^a-zA-Z0-9-_]/g, '');
    const fileName = `${safeContactId}_${Date.now()}.webp`;
    const outputPath = path.join(uploadDir, fileName);

    if (!safeFileOperation(outputPath, uploadDir)) {
      if (safeFileOperation(file.path, 'temp/')) {
        fs.unlinkSync(file.path);
      }
      return { success: false, error: 'Invalid file path', status: 400 };
    }

    await sharp(file.path)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(outputPath);

    if (safeFileOperation(file.path, 'temp/')) {
      fs.unlinkSync(file.path);
    }

    const photoRecord = await storage.contacts.createPhoto({
      contactId,
      fileName,
      filePath: `/uploads/contact-photos/${fileName}`,
      fileSize: fs.statSync(outputPath).size,
      mimeType: 'image/webp',
      source: 'manual',
      isActive: true,
    });

    const avatarUrl = `/uploads/contact-photos/${fileName}`;
    await storage.contacts.update(contactId, { avatarUrl });

    return {
      success: true,
      avatarUrl,
      photoId: photoRecord.id,
      fileSize: photoRecord.fileSize,
    };
  }

  async addTagToContacts(
    contactIds: string[],
    tagId: string,
    tagName?: string,
    tagColor?: string
  ): Promise<{ success: boolean; tagId: string; contactTags: ContactTag[] }> {
    let finalTagId = tagId;

    if (!tagId && tagName) {
      const newTag = await storage.contacts.createTag({
        name: tagName,
        color: tagColor ?? '#3b82f6',
      });
      finalTagId = newTag.id;
    }

    if (!finalTagId) {
      throw new Error('Tag ID or tag name is required');
    }

    const contactTags = await storage.contacts.addTagToMultiple(contactIds, finalTagId);
    return { success: true, contactTags, tagId: finalTagId };
  }

  async removeTagFromContacts(contactIds: string[], tagId: string): Promise<boolean> {
    return storage.contacts.removeTagFromMultiple(contactIds, tagId);
  }
}

export const contactService = new ContactService();
