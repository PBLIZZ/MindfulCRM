import { 
  users, contacts, interactions, goals, documents, syncStatus,
  type User, type InsertUser, type Contact, type InsertContact,
  type Interaction, type InsertInteraction, type Goal, type InsertGoal,
  type Document, type InsertDocument, type SyncStatus, type InsertSyncStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;

  // Contacts
  getContactsByUserId(userId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  // Interactions
  getInteractionsByContactId(contactId: string): Promise<Interaction[]>;
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
  getRecentInteractions(userId: string, limit?: number): Promise<(Interaction & { contact: Contact })[]>;

  // Goals
  getGoalsByContactId(contactId: string): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal>;

  // Documents
  getDocumentsByContactId(contactId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;

  // Sync Status
  getSyncStatus(userId: string): Promise<SyncStatus[]>;
  updateSyncStatus(userId: string, service: string, status: Partial<InsertSyncStatus>): Promise<SyncStatus>;

  // Analytics
  getStats(userId: string): Promise<{
    totalClients: number;
    weeklySessions: number;
    achievedGoals: number;
    responseRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getContactsByUserId(userId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.userId, userId)).orderBy(desc(contacts.lastContact));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return contact;
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async getInteractionsByContactId(contactId: string): Promise<Interaction[]> {
    return await db.select().from(interactions).where(eq(interactions.contactId, contactId)).orderBy(desc(interactions.timestamp));
  }

  async createInteraction(insertInteraction: InsertInteraction): Promise<Interaction> {
    const [interaction] = await db
      .insert(interactions)
      .values(insertInteraction)
      .returning();
    return interaction;
  }

  async getRecentInteractions(userId: string, limit = 10): Promise<(Interaction & { contact: Contact })[]> {
    const result = await db
      .select()
      .from(interactions)
      .innerJoin(contacts, eq(interactions.contactId, contacts.id))
      .where(eq(contacts.userId, userId))
      .orderBy(desc(interactions.timestamp))
      .limit(limit);
    
    return result.map(row => ({
      ...row.interactions,
      contact: row.contacts
    }));
  }

  async getGoalsByContactId(contactId: string): Promise<Goal[]> {
    return await db.select().from(goals).where(eq(goals.contactId, contactId)).orderBy(desc(goals.createdAt));
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db
      .insert(goals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal> {
    const [goal] = await db
      .update(goals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(goals.id, id))
      .returning();
    return goal;
  }

  async getDocumentsByContactId(contactId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.contactId, contactId)).orderBy(desc(documents.createdAt));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async getSyncStatus(userId: string): Promise<SyncStatus[]> {
    return await db.select().from(syncStatus).where(eq(syncStatus.userId, userId));
  }

  async updateSyncStatus(userId: string, service: string, status: Partial<InsertSyncStatus>): Promise<SyncStatus> {
    const existing = await db.select().from(syncStatus).where(
      and(eq(syncStatus.userId, userId), eq(syncStatus.service, service))
    );

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
      .where(
        and(
          eq(contacts.userId, userId),
          eq(goals.status, 'completed')
        )
      );

    // Calculate response rate based on email interactions
    const [totalEmailsResult] = await db
      .select({ count: sql`count(*)` })
      .from(interactions)
      .innerJoin(contacts, eq(interactions.contactId, contacts.id))
      .where(
        and(
          eq(contacts.userId, userId),
          eq(interactions.type, 'email')
        )
      );

    const totalClients = Number(totalClientsResult.count) || 0;
    const weeklySessions = Number(weeklySessionsResult.count) || 0;
    const achievedGoals = Number(achievedGoalsResult.count) || 0;
    const totalEmails = Number(totalEmailsResult.count) || 0;
    
    // Mock response rate calculation - in real implementation, this would track actual responses
    const responseRate = totalEmails > 0 ? Math.min(95, 80 + (totalEmails % 20)) : 0;

    return {
      totalClients,
      weeklySessions,
      achievedGoals,
      responseRate
    };
  }
}

export const storage = new DatabaseStorage();
