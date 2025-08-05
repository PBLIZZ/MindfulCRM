import { db } from '../db.js';
import {
  documents,
  syncStatus,
  contacts,
  interactions,
  goals,
  type Document,
  type InsertDocument,
  type SyncStatus,
  type InsertSyncStatus,
} from '../../shared/schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export class MiscData {
  // --- Documents ---
  async getDocumentsByContactId(contactId: string): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(eq(documents.contactId, contactId))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  // --- Sync Status ---
  async getSyncStatus(userId: string): Promise<SyncStatus[]> {
    return db.select().from(syncStatus).where(eq(syncStatus.userId, userId));
  }

  async updateSyncStatus(
    userId: string,
    service: string,
    status: Partial<InsertSyncStatus>
  ): Promise<SyncStatus> {
    const existing = await db
      .select()
      .from(syncStatus)
      .where(and(eq(syncStatus.userId, userId), eq(syncStatus.service, service)));
    if (existing.length > 0) {
      const [updated] = await db
        .update(syncStatus)
        .set(status)
        .where(and(eq(syncStatus.userId, userId), eq(syncStatus.service, service)))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(syncStatus)
        .values({ userId, service, ...status })
        .returning();
      return created;
    }
  }

  // --- Aggregate Stats ---
  async getStats(userId: string): Promise<{
    totalClients: number;
    weeklySessions: number;
    achievedGoals: number;
    responseRate: number;
  }> {
    const [totalClientsResult] = await db
      .select({ count: sql`count(*)` })
      .from(contacts)
      .where(eq(contacts.userId, userId));

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const [weeklySessionsResult] = await db
      .select({ count: sql`count(*)` })
      .from(interactions)
      .innerJoin(contacts, eq(interactions.contactId, contacts.id))
      .where(
        and(
          eq(contacts.userId, userId),
          eq(interactions.type, 'meeting'),
          gte(interactions.timestamp, weekAgo)
        )
      );

    const [achievedGoalsResult] = await db
      .select({ count: sql`count(*)` })
      .from(goals)
      .innerJoin(contacts, eq(goals.contactId, contacts.id))
      .where(and(eq(contacts.userId, userId), eq(goals.status, 'completed')));

    const totalClients = Number(totalClientsResult.count ?? 0);
    const weeklySessions = Number(weeklySessionsResult.count ?? 0);
    const achievedGoals = Number(achievedGoalsResult.count ?? 0);

    return { totalClients, weeklySessions, achievedGoals, responseRate: 0 }; // responseRate is mocked
  }
}
