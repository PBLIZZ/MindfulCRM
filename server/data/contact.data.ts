import { db } from '../db.js';
import {
  contacts,
  contactPhotos,
  tags,
  contactTags,
  type Contact,
  type InsertContact,
  type ContactPhoto,
  type InsertContactPhoto,
  type Tag,
  type InsertTag,
  type ContactTag,
} from '../../shared/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export class ContactData {
  async getByUserId(userId: string): Promise<(Contact & { tags: Tag[] })[]> {
    // PERFORMANCE OPTIMIZATION: Single JOIN query replaces N+1 pattern
    // Previously: 1 + N queries, Now: 1 query with JOIN
    const result = await db
      .select({
        contact: contacts,
        tag: tags,
      })
      .from(contacts)
      .leftJoin(contactTags, eq(contacts.id, contactTags.contactId))
      .leftJoin(tags, eq(contactTags.tagId, tags.id))
      .where(eq(contacts.userId, userId))
      .orderBy(desc(contacts.lastContact));

    // Group results by contact to handle multiple tags per contact
    const contactMap = new Map<string, Contact & { tags: Tag[] }>();

    result.forEach((row) => {
      const contact = row.contact;
      const tag = row.tag;

      if (!contactMap.has(contact.id)) {
        contactMap.set(contact.id, { ...contact, tags: [] });
      }

      if (tag) {
        contactMap.get(contact.id)!.tags.push(tag);
      }
    });

    return Array.from(contactMap.values());
  }

  async getById(id: string): Promise<(Contact & { tags: Tag[] }) | undefined> {
    // PERFORMANCE OPTIMIZATION: Single JOIN query replaces N+1 pattern
    const result = await db
      .select({
        contact: contacts,
        tag: tags,
      })
      .from(contacts)
      .leftJoin(contactTags, eq(contacts.id, contactTags.contactId))
      .leftJoin(tags, eq(contactTags.tagId, tags.id))
      .where(eq(contacts.id, id));

    if (result.length === 0) return undefined;

    const contact = result[0]!.contact;
    const contactTagsList: Tag[] = result
      .map(row => row.tag)
      .filter((tag): tag is Tag => tag !== null);

    return { ...contact, tags: contactTagsList };
  }

  async create(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async update(id: string, updates: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return contact;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // --- Photos ---
  async createPhoto(photo: InsertContactPhoto): Promise<ContactPhoto> {
    const [newPhoto] = await db.insert(contactPhotos).values(photo).returning();
    return newPhoto;
  }

  async getPhotos(contactId: string): Promise<ContactPhoto[]> {
    return db
      .select()
      .from(contactPhotos)
      .where(eq(contactPhotos.contactId, contactId))
      .orderBy(desc(contactPhotos.createdAt));
  }

  async deletePhoto(id: string): Promise<boolean> {
    const result = await db.delete(contactPhotos).where(eq(contactPhotos.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // --- Tags ---
  // PERFORMANCE NOTE: getTagsForContact method removed - now using optimized JOINs

  async getAllTags(): Promise<Tag[]> {
    return db.select().from(tags).orderBy(tags.name);
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [newTag] = await db.insert(tags).values(tag).returning();
    return newTag;
  }

  async addTag(contactId: string, tagId: string): Promise<ContactTag> {
    const [contactTag] = await db.insert(contactTags).values({ contactId, tagId }).returning();
    return contactTag;
  }

  async removeTag(contactId: string, tagId: string): Promise<boolean> {
    const result = await db
      .delete(contactTags)
      .where(and(eq(contactTags.contactId, contactId), eq(contactTags.tagId, tagId)));
    return (result.rowCount ?? 0) > 0;
  }

  async addTagToMultiple(contactIds: string[], tagId: string): Promise<ContactTag[]> {
    const inserts = contactIds.map((contactId) => ({ contactId, tagId }));
    return db.insert(contactTags).values(inserts).returning();
  }

  async removeTagFromMultiple(contactIds: string[], tagId: string): Promise<boolean> {
    const result = await db
      .delete(contactTags)
      .where(and(sql`${contactTags.contactId} IN ${contactIds}`, eq(contactTags.tagId, tagId)));
    return (result.rowCount ?? 0) > 0;
  }
}

export const contactData = new ContactData();
