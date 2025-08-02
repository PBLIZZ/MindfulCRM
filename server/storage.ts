import {
  users,
  contacts,
  interactions,
  goals,
  documents,
  syncStatus,
  calendarEvents,
  emails,
  contactPhotos,
  tags,
  contactTags,
  processedEvents,
  projects,
  tasks,
  taskActivities,
  aiSuggestions,
  dataProcessingJobs,
  type User,
  type InsertUser,
  type Contact,
  type InsertContact,
  type Interaction,
  type InsertInteraction,
  type Goal,
  type InsertGoal,
  type Document,
  type InsertDocument,
  type SyncStatus,
  type InsertSyncStatus,
  type CalendarEvent,
  type InsertCalendarEvent,
  type Email,
  type InsertEmail,
  type ContactPhoto,
  type InsertContactPhoto,
  type Tag,
  type InsertTag,
  type ContactTag,
  type InsertContactTag,
  type ProcessedEvent,
  type InsertProcessedEvent,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type TaskActivity,
  type InsertTaskActivity,
  type AiSuggestion,
  type InsertAiSuggestion,
  type DataProcessingJob,
  type InsertDataProcessingJob,
} from '@shared/schema';
import { db } from './db';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserGdprConsent(
    id: string,
    consent: {
      allowProfilePictureScraping: boolean;
      gdprConsentDate: Date;
      gdprConsentVersion: string;
    }
  ): Promise<User>;

  // Contacts
  getContactsByUserId(userId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string): Promise<boolean>;

  // Interactions
  getInteractionsByContactId(contactId: string): Promise<Interaction[]>;
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
  getRecentInteractions(
    userId: string,
    limit?: number
  ): Promise<(Interaction & { contact: Contact })[]>;

  // Goals
  getGoalsByContactId(contactId: string): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal>;

  // Documents
  getDocumentsByContactId(contactId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;

  // Sync Status
  getSyncStatus(userId: string): Promise<SyncStatus[]>;
  updateSyncStatus(
    userId: string,
    service: string,
    status: Partial<InsertSyncStatus>
  ): Promise<SyncStatus>;

  // Analytics
  getStats(userId: string): Promise<{
    totalClients: number;
    weeklySessions: number;
    achievedGoals: number;
    responseRate: number;
  }>;

  // Emails (Raw Gmail Data - Filtered Business Emails)
  getEmailsByUserId(userId: string, limit?: number): Promise<Email[]>;
  getEmailsByContactId(contactId: string): Promise<Email[]>;
  getEmailByGmailId(userId: string, gmailMessageId: string): Promise<Email | undefined>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email>;
  getUnprocessedEmails(userId: string): Promise<Email[]>;
  markEmailProcessed(id: string, extractedData: any): Promise<Email>;

  // Calendar Events (Raw Google Data)
  getCalendarEventsByUserId(userId: string, limit?: number): Promise<CalendarEvent[]>;
  getCalendarEventsByContactId(contactId: string): Promise<CalendarEvent[]>;
  getCalendarEventByGoogleId(
    userId: string,
    googleEventId: string
  ): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  getUnprocessedCalendarEvents(userId: string): Promise<CalendarEvent[]>;
  markCalendarEventProcessed(id: string, extractedData: any): Promise<CalendarEvent>;

  // Contact Photos
  createContactPhoto(photo: InsertContactPhoto): Promise<ContactPhoto>;
  getContactPhotos(contactId: string): Promise<ContactPhoto[]>;
  deleteContactPhoto(id: string): Promise<boolean>;

  // Tags
  getAllTags(): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  addTagToContact(contactId: string, tagId: string): Promise<ContactTag>;
  removeTagFromContact(contactId: string, tagId: string): Promise<boolean>;
  addTagToContacts(contactIds: string[], tagId: string): Promise<ContactTag[]>;
  removeTagFromContacts(contactIds: string[], tagId: string): Promise<boolean>;

  // Processed Events - for deduplication and change tracking
  getEventHash(event: CalendarEvent): Promise<string>;
  shouldProcessEvent(eventId: string): Promise<boolean>;
  markEventProcessed(
    eventId: string,
    eventHash: string,
    isRelevant: boolean,
    analysis?: any,
    llmModel?: string
  ): Promise<ProcessedEvent>;
  getProcessedEvent(eventId: string): Promise<ProcessedEvent | undefined>;

  // Task Management
  // Projects
  getProjectsByUserId(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;

  // Tasks
  getTasksByUserId(userId: string, statuses?: string[]): Promise<Task[]>;
  getTasksByProjectId(projectId: string): Promise<Task[]>;
  getTasksByStatus(status: string, owner?: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<boolean>;
  getSubtasks(parentTaskId: string): Promise<Task[]>;

  // Task Activities
  getTaskActivities(taskId: string): Promise<TaskActivity[]>;
  createTaskActivity(activity: InsertTaskActivity): Promise<TaskActivity>;

  // AI Suggestions
  getAiSuggestionsByUserId(userId: string, status?: string): Promise<AiSuggestion[]>;
  getAiSuggestion(id: string): Promise<AiSuggestion | undefined>;
  createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion>;
  updateAiSuggestion(id: string, updates: Partial<InsertAiSuggestion>): Promise<AiSuggestion>;
  cleanupOldSuggestions(olderThan: Date): Promise<boolean>;

  // Data Processing Jobs
  getDataProcessingJobsByUserId(userId: string): Promise<DataProcessingJob[]>;
  getFailedDataProcessingJobs(userId: string): Promise<DataProcessingJob[]>;
  createDataProcessingJob(job: InsertDataProcessingJob): Promise<DataProcessingJob>;
  updateDataProcessingJob(
    id: string,
    updates: Partial<InsertDataProcessingJob>
  ): Promise<DataProcessingJob>;
  cleanupOldDataProcessingJobs(olderThan: Date): Promise<boolean>;

  // Helper methods for scheduler
  getActiveUsers(daysSinceLastActivity: number): Promise<Array<{ id: string; email: string }>>;
  getRecentEmails(userId: string, daysBack: number): Promise<Email[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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

  async updateUserGdprConsent(
    id: string,
    consent: {
      allowProfilePictureScraping: boolean;
      gdprConsentDate: Date;
      gdprConsentVersion: string;
    }
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        allowProfilePictureScraping: consent.allowProfilePictureScraping,
        gdprConsentDate: consent.gdprConsentDate,
        gdprConsentVersion: consent.gdprConsentVersion,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getContactsByUserId(userId: string): Promise<Contact[]> {
    // First get the contacts
    const contactList = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(desc(contacts.lastContact));

    // Then get tags for each contact
    const contactsWithTags = await Promise.all(
      contactList.map(async (contact) => {
        const contactTagsData = await db
          .select({
            tag: tags,
          })
          .from(contactTags)
          .innerJoin(tags, eq(contactTags.tagId, tags.id))
          .where(eq(contactTags.contactId, contact.id));

        return {
          ...contact,
          tags: contactTagsData.map((ct) => ct.tag),
        };
      })
    );

    return contactsWithTags;
  }

  async getContact(id: string): Promise<(Contact & { tags: Tag[] }) | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    if (!contact) return undefined;

    // Get tags for this contact
    const contactTagsData = await db
      .select({
        tag: tags,
      })
      .from(contactTags)
      .innerJoin(tags, eq(contactTags.tagId, tags.id))
      .where(eq(contactTags.contactId, contact.id));

    return {
      ...contact,
      tags: contactTagsData.map((ct) => ct.tag),
    };
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
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

  async deleteContact(id: string): Promise<boolean> {
    try {
      await db.delete(contacts).where(eq(contacts.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      return false;
    }
  }

  async getInteractionsByContactId(contactId: string): Promise<Interaction[]> {
    return await db
      .select()
      .from(interactions)
      .where(eq(interactions.contactId, contactId))
      .orderBy(desc(interactions.timestamp));
  }

  async createInteraction(insertInteraction: InsertInteraction): Promise<Interaction> {
    // Auto-analyze sentiment if not provided and content exists
    if (!insertInteraction.sentiment && insertInteraction.content) {
      try {
        const { mistralService } = await import('./services/mistral');
        const sentimentResult = await mistralService.analyzeSentiment(insertInteraction.content);
        insertInteraction.sentiment = sentimentResult.rating;
      } catch (error) {
        console.warn('Failed to analyze sentiment for interaction:', error);
        // Continue without sentiment - it's not critical
      }
    }

    const [interaction] = await db.insert(interactions).values(insertInteraction).returning();
    return interaction;
  }

  async getRecentInteractions(
    userId: string,
    limit = 10
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
    return await db
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

  async getDocumentsByContactId(contactId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.contactId, contactId))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(insertDocument).returning();
    return document;
  }

  async getSyncStatus(userId: string): Promise<SyncStatus[]> {
    return await db.select().from(syncStatus).where(eq(syncStatus.userId, userId));
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

    // Calculate response rate based on email interactions
    const [totalEmailsResult] = await db
      .select({ count: sql`count(*)` })
      .from(interactions)
      .innerJoin(contacts, eq(interactions.contactId, contacts.id))
      .where(and(eq(contacts.userId, userId), eq(interactions.type, 'email')));

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
      responseRate,
    };
  }

  // Emails (Raw Gmail Data - Filtered Business Emails)
  async getEmailsByUserId(userId: string, limit: number = 100): Promise<Email[]> {
    return await db
      .select()
      .from(emails)
      .where(eq(emails.userId, userId))
      .orderBy(desc(emails.timestamp))
      .limit(limit);
  }

  async getEmailsByContactId(contactId: string): Promise<Email[]> {
    return await db
      .select()
      .from(emails)
      .where(eq(emails.contactId, contactId))
      .orderBy(desc(emails.timestamp));
  }

  async getEmailByGmailId(userId: string, gmailMessageId: string): Promise<Email | undefined> {
    const [email] = await db
      .select()
      .from(emails)
      .where(and(eq(emails.userId, userId), eq(emails.gmailMessageId, gmailMessageId)));
    return email || undefined;
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const [email] = await db.insert(emails).values(insertEmail).returning();
    return email;
  }

  async updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email> {
    const [email] = await db
      .update(emails)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emails.id, id))
      .returning();
    return email;
  }

  async getUnprocessedEmails(userId: string): Promise<Email[]> {
    return await db
      .select()
      .from(emails)
      .where(and(eq(emails.userId, userId), eq(emails.processed, false)))
      .orderBy(desc(emails.timestamp));
  }

  async markEmailProcessed(id: string, extractedData: any): Promise<Email> {
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

  // Calendar Events (Raw Google Data)
  async getCalendarEventsByUserId(userId: string, limit: number = 100): Promise<CalendarEvent[]> {
    return await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.userId, userId))
      .orderBy(desc(calendarEvents.startTime))
      .limit(limit);
  }

  async getCalendarEventsByContactId(contactId: string): Promise<CalendarEvent[]> {
    return await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.contactId, contactId))
      .orderBy(desc(calendarEvents.startTime));
  }

  async getCalendarEventByGoogleId(
    userId: string,
    googleEventId: string
  ): Promise<CalendarEvent | undefined> {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(eq(calendarEvents.userId, userId), eq(calendarEvents.googleEventId, googleEventId))
      );
    return event || undefined;
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(calendarEvents).values(insertEvent).returning();
    return event;
  }

  async updateCalendarEvent(
    id: string,
    updates: Partial<InsertCalendarEvent>
  ): Promise<CalendarEvent> {
    const [event] = await db
      .update(calendarEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return event;
  }

  async getUnprocessedCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    return await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.processed, false)))
      .orderBy(desc(calendarEvents.startTime));
  }

  async markCalendarEventProcessed(id: string, extractedData: any): Promise<CalendarEvent> {
    const [event] = await db
      .update(calendarEvents)
      .set({
        processed: true,
        extractedData,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, id))
      .returning();
    return event;
  }

  // Contact Photos
  async createContactPhoto(insertPhoto: InsertContactPhoto): Promise<ContactPhoto> {
    const [photo] = await db.insert(contactPhotos).values(insertPhoto).returning();
    return photo;
  }

  async getContactPhotos(contactId: string): Promise<ContactPhoto[]> {
    return await db
      .select()
      .from(contactPhotos)
      .where(eq(contactPhotos.contactId, contactId))
      .orderBy(desc(contactPhotos.createdAt));
  }

  async deleteContactPhoto(id: string): Promise<boolean> {
    try {
      await db.delete(contactPhotos).where(eq(contactPhotos.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting contact photo:', error);
      return false;
    }
  }

  // Tag methods
  async getAllTags(): Promise<Tag[]> {
    return await db.select().from(tags).orderBy(tags.name);
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [newTag] = await db.insert(tags).values(tag).returning();
    return newTag;
  }

  async addTagToContact(contactId: string, tagId: string): Promise<ContactTag> {
    const [contactTag] = await db.insert(contactTags).values({ contactId, tagId }).returning();
    return contactTag;
  }

  async removeTagFromContact(contactId: string, tagId: string): Promise<boolean> {
    try {
      await db
        .delete(contactTags)
        .where(and(eq(contactTags.contactId, contactId), eq(contactTags.tagId, tagId)));
      return true;
    } catch (error) {
      console.error('Error removing tag from contact:', error);
      return false;
    }
  }

  async addTagToContacts(contactIds: string[], tagId: string): Promise<ContactTag[]> {
    const contactTagInserts = contactIds.map((contactId) => ({
      contactId,
      tagId,
    }));
    return await db.insert(contactTags).values(contactTagInserts).returning();
  }

  async removeTagFromContacts(contactIds: string[], tagId: string): Promise<boolean> {
    try {
      await db
        .delete(contactTags)
        .where(
          and(sql`${contactTags.contactId} = ANY(${contactIds})`, eq(contactTags.tagId, tagId))
        );
      return true;
    } catch (error) {
      console.error('Error removing tag from contacts:', error);
      return false;
    }
  }

  // Processed Events methods
  async getEventHash(event: CalendarEvent): Promise<string> {
    const hashData = {
      summary: event.summary,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      attendees: event.attendees,
      location: event.location,
    };

    return crypto.createHash('sha256').update(JSON.stringify(hashData)).digest('hex');
  }

  async shouldProcessEvent(eventId: string): Promise<boolean> {
    const existingRecord = await this.getProcessedEvent(eventId);

    if (!existingRecord) return true;

    // Get the current event data
    const [currentEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, eventId));

    if (!currentEvent) return false;

    // Check if event has changed by comparing hashes
    const currentHash = await this.getEventHash(currentEvent);
    return existingRecord.eventHash !== currentHash;
  }

  async markEventProcessed(
    eventId: string,
    eventHash: string,
    isRelevant: boolean,
    analysis?: any,
    llmModel?: string
  ): Promise<ProcessedEvent> {
    const processedEventData: InsertProcessedEvent = {
      eventId,
      eventHash,
      processedAt: new Date(),
      lastModified: new Date(),
      isRelevant,
      analysis,
      llmModel,
    };

    // Use upsert pattern - try to insert, if conflict then update
    const [processedEvent] = await db
      .insert(processedEvents)
      .values(processedEventData)
      .onConflictDoUpdate({
        target: processedEvents.eventId,
        set: {
          eventHash,
          processedAt: new Date(),
          lastModified: new Date(),
          isRelevant,
          analysis,
          llmModel,
          updatedAt: new Date(),
        },
      })
      .returning();

    return processedEvent;
  }

  async getProcessedEvent(eventId: string): Promise<ProcessedEvent | undefined> {
    const [processedEvent] = await db
      .select()
      .from(processedEvents)
      .where(eq(processedEvents.eventId, eventId));
    return processedEvent || undefined;
  }

  // Task Management Implementation
  // Projects
  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.isArchived, false)))
      .orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    try {
      await db.update(projects).set({ isArchived: true }).where(eq(projects.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      return false;
    }
  }

  // Tasks
  async getTasksByUserId(userId: string, statuses?: string[]): Promise<Task[]> {
    let whereConditions = [eq(tasks.userId, userId)];

    if (statuses && statuses.length > 0) {
      whereConditions.push(sql`${tasks.status} = ANY(${statuses})`);
    }

    return await db
      .select()
      .from(tasks)
      .where(and(...whereConditions))
      .orderBy(desc(tasks.createdAt));
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(tasks.orderIndex, desc(tasks.createdAt));
  }

  async getTasksByStatus(
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting_approval',
    owner?: 'user' | 'ai_assistant'
  ): Promise<Task[]> {
    let whereConditions = [eq(tasks.status, status)];

    if (owner) {
      whereConditions.push(eq(tasks.owner, owner));
    }

    return await db
      .select()
      .from(tasks)
      .where(and(...whereConditions))
      .orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: string): Promise<boolean> {
    try {
      await db.delete(tasks).where(eq(tasks.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  }

  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.parentTaskId, parentTaskId))
      .orderBy(tasks.orderIndex, desc(tasks.createdAt));
  }

  // Task Activities
  async getTaskActivities(taskId: string): Promise<TaskActivity[]> {
    return await db
      .select()
      .from(taskActivities)
      .where(eq(taskActivities.taskId, taskId))
      .orderBy(desc(taskActivities.createdAt));
  }

  async createTaskActivity(activity: InsertTaskActivity): Promise<TaskActivity> {
    const [newActivity] = await db.insert(taskActivities).values(activity).returning();
    return newActivity;
  }

  // AI Suggestions
  async getAiSuggestionsByUserId(userId: string, status?: string): Promise<AiSuggestion[]> {
    let whereConditions = [eq(aiSuggestions.userId, userId)];

    if (status) {
      whereConditions.push(eq(aiSuggestions.status, status));
    }

    return await db
      .select()
      .from(aiSuggestions)
      .where(and(...whereConditions))
      .orderBy(desc(aiSuggestions.createdAt));
  }

  async getAiSuggestion(id: string): Promise<AiSuggestion | undefined> {
    const [suggestion] = await db.select().from(aiSuggestions).where(eq(aiSuggestions.id, id));
    return suggestion || undefined;
  }

  async createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion> {
    const [newSuggestion] = await db.insert(aiSuggestions).values(suggestion).returning();
    return newSuggestion;
  }

  async updateAiSuggestion(
    id: string,
    updates: Partial<InsertAiSuggestion>
  ): Promise<AiSuggestion> {
    const [suggestion] = await db
      .update(aiSuggestions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiSuggestions.id, id))
      .returning();
    return suggestion;
  }

  async cleanupOldSuggestions(olderThan: Date): Promise<boolean> {
    try {
      await db
        .delete(aiSuggestions)
        .where(
          and(
            lte(aiSuggestions.createdAt, olderThan),
            sql`${aiSuggestions.status} IN ('executed', 'rejected')`
          )
        );
      return true;
    } catch (error) {
      console.error('Error cleaning up old suggestions:', error);
      return false;
    }
  }

  // Data Processing Jobs
  async getDataProcessingJobsByUserId(userId: string): Promise<DataProcessingJob[]> {
    return await db
      .select()
      .from(dataProcessingJobs)
      .where(eq(dataProcessingJobs.userId, userId))
      .orderBy(desc(dataProcessingJobs.createdAt));
  }

  async getFailedDataProcessingJobs(userId: string): Promise<DataProcessingJob[]> {
    return await db
      .select()
      .from(dataProcessingJobs)
      .where(and(eq(dataProcessingJobs.userId, userId), eq(dataProcessingJobs.status, 'failed')))
      .orderBy(desc(dataProcessingJobs.createdAt));
  }

  async createDataProcessingJob(job: InsertDataProcessingJob): Promise<DataProcessingJob> {
    const [newJob] = await db.insert(dataProcessingJobs).values(job).returning();
    return newJob;
  }

  async updateDataProcessingJob(
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

  async cleanupOldDataProcessingJobs(olderThan: Date): Promise<boolean> {
    try {
      await db
        .delete(dataProcessingJobs)
        .where(
          and(
            lte(dataProcessingJobs.createdAt, olderThan),
            sql`${dataProcessingJobs.status} IN ('completed', 'failed')`
          )
        );
      return true;
    } catch (error) {
      console.error('Error cleaning up old data processing jobs:', error);
      return false;
    }
  }

  // Helper methods for scheduler
  async getActiveUsers(
    daysSinceLastActivity: number
  ): Promise<Array<{ id: string; email: string }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActivity);

    return await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(gte(users.updatedAt, cutoffDate));
  }

  async getRecentEmails(userId: string, daysBack: number): Promise<Email[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    return await db
      .select()
      .from(emails)
      .where(and(eq(emails.userId, userId), gte(emails.timestamp, cutoffDate)))
      .orderBy(desc(emails.timestamp));
  }
}

export const storage = new DatabaseStorage();
