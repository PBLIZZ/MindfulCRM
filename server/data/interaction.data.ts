import { db } from '../db.js';
import {
  interactions,
  goals,
  contacts,
  type Interaction,
  type InsertInteraction,
  type Goal,
  type InsertGoal,
  type Contact,
} from '../../shared/schema.js';
import { eq, desc } from 'drizzle-orm';

export class InteractionData {
  async getByContactId(contactId: string): Promise<Interaction[]> {
    return db
      .select()
      .from(interactions)
      .where(eq(interactions.contactId, contactId))
      .orderBy(desc(interactions.timestamp));
  }

  async create(insertInteraction: InsertInteraction): Promise<Interaction> {
    // Note: Sentiment analysis logic has been moved to the service layer
    // to keep the data layer strictly for data operations.
    const [interaction] = await db.insert(interactions).values(insertInteraction).returning();
    return interaction;
  }

  async getRecentForUser(
    userId: string,
    limit: number
  ): Promise<(Interaction & { contact: Contact })[]> {
    const result = await db
      .select()
      .from(interactions)
      .innerJoin(contacts, eq(interactions.contactId, contacts.id))
      .where(eq(contacts.userId, userId))
      .orderBy(desc(interactions.timestamp))
      .limit(limit);

    return result.map((row) => ({
      ...row.interactions,
      contact: row.contacts,
    }));
  }

  async getGoalsByContactId(contactId: string): Promise<Goal[]> {
    return db
      .select()
      .from(goals)
      .where(eq(goals.contactId, contactId))
      .orderBy(desc(goals.createdAt));
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db.insert(goals).values(insertGoal).returning();
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
}
