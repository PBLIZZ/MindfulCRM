import { db } from '../db.js';
import { emails, type Email, type InsertEmail } from '../../shared/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

export class EmailData {
  async getByUserId(userId: string, limit: number = 100): Promise<Email[]> {
    return db
      .select()
      .from(emails)
      .where(eq(emails.userId, userId))
      .orderBy(desc(emails.timestamp))
      .limit(limit);
  }

  async getByContactId(contactId: string): Promise<Email[]> {
    return db
      .select()
      .from(emails)
      .where(eq(emails.contactId, contactId))
      .orderBy(desc(emails.timestamp));
  }

  async findByGmailId(userId: string, gmailMessageId: string): Promise<Email | undefined> {
    const [email] = await db
      .select()
      .from(emails)
      .where(and(eq(emails.userId, userId), eq(emails.gmailMessageId, gmailMessageId)));
    return email;
  }

  async create(insertEmail: InsertEmail): Promise<Email> {
    const [email] = await db.insert(emails).values(insertEmail).returning();
    return email;
  }

  async update(id: string, updates: Partial<InsertEmail>): Promise<Email> {
    const [email] = await db
      .update(emails)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emails.id, id))
      .returning();
    return email;
  }

  async getUnprocessed(userId: string): Promise<Email[]> {
    return db
      .select()
      .from(emails)
      .where(and(eq(emails.userId, userId), eq(emails.processed, false)))
      .orderBy(desc(emails.timestamp));
  }

  async markProcessed(id: string, extractedData: Record<string, unknown>): Promise<Email> {
    const [email] = await db
      .update(emails)
      .set({
        processed: true,
        extractedData,
        updatedAt: new Date(),
      })
      .where(eq(emails.id, id))
      .returning();
    return email;
  }

  async getRecent(userId: string, daysBack: number): Promise<Email[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    return db
      .select()
      .from(emails)
      .where(and(eq(emails.userId, userId), gte(emails.timestamp, cutoffDate)))
      .orderBy(desc(emails.timestamp));
  }
}
