import { storage } from '../data/index.js';
import { type Tag, type InsertTag } from '../../shared/schema.js';

export class TagService {
  async getAllTags(): Promise<Tag[]> {
    // Tag data methods are part of the contacts data module
    return storage.contacts.getAllTags();
  }

  async createTag(tagData: InsertTag): Promise<Tag> {
    // Business Rule: Ensure tag name is not empty
    if (!tagData.name?.trim()) {
      throw new Error('Tag name is required');
    }

    try {
      // Data Access: Call the namespaced data module
      return await storage.contacts.createTag({
        name: tagData.name.trim(),
        color: tagData.color ?? '#3b82f6',
      });
    } catch (error: unknown) {
      // Business Rule: Provide a user-friendly error for a known database constraint
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        throw new Error('A tag with this name already exists');
      }
      throw error; // Re-throw other unexpected errors
    }
  }
}

export const tagService = new TagService();
