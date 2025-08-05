import { db } from '../db.js';
import {
  aiSuggestions,
  dataProcessingJobs,
  type AiSuggestion,
  type InsertAiSuggestion,
  type DataProcessingJob,
  type InsertDataProcessingJob,
} from '../../shared/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export class AiData {
  // --- AI Suggestions ---
  async getSuggestionsByUserId(userId: string, status?: string): Promise<AiSuggestion[]> {
    const conditions = [eq(aiSuggestions.userId, userId)];
    if (status) {
      conditions.push(eq(aiSuggestions.status, status));
    }
    return db
      .select()
      .from(aiSuggestions)
      .where(and(...conditions))
      .orderBy(desc(aiSuggestions.createdAt));
  }

  async getSuggestionById(id: string): Promise<AiSuggestion | undefined> {
    const [suggestion] = await db.select().from(aiSuggestions).where(eq(aiSuggestions.id, id));
    return suggestion;
  }

  async createSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion> {
    const [newSuggestion] = await db.insert(aiSuggestions).values(suggestion).returning();
    return newSuggestion;
  }

  async updateSuggestion(id: string, updates: Partial<InsertAiSuggestion>): Promise<AiSuggestion> {
    const [suggestion] = await db
      .update(aiSuggestions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiSuggestions.id, id))
      .returning();
    return suggestion;
  }

  // --- Data Processing Jobs ---
  async getJobsByUserId(userId: string): Promise<DataProcessingJob[]> {
    return db
      .select()
      .from(dataProcessingJobs)
      .where(eq(dataProcessingJobs.userId, userId))
      .orderBy(desc(dataProcessingJobs.createdAt));
  }

  async createJob(job: InsertDataProcessingJob): Promise<DataProcessingJob> {
    const [newJob] = await db.insert(dataProcessingJobs).values(job).returning();
    return newJob;
  }

  async updateJob(
    id: string,
    updates: Partial<InsertDataProcessingJob>
  ): Promise<DataProcessingJob> {
    const [job] = await db
      .update(dataProcessingJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataProcessingJobs.id, id))
      .returning();
    return job;
  }
}
