import {
  users,
  contacts,
  interactions,
  goals,
  documents,
  syncStatus,
  calendarEvents,
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
} from '@shared/schema';
import { db } from './db';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

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
  // Calendar Events
  getCalendarEvents(userId: string, month?: string): Promise<any[]>;
  createUICalendarEvent(event: any): Promise<any>;

  // Email Management
  getEmails(userId: string, folder: string): Promise<any[]>;
  sendEmail(emailData: any): Promise<any>;
  markEmailAsRead(emailId: string): Promise<boolean>;
  toggleEmailStar(emailId: string): Promise<boolean>;
  moveEmail(emailId: string, folder: string): Promise<boolean>;

  // Calendar Events (Raw Google Data)
  getCalendarEventsByUserId(userId: string, limit?: number): Promise<CalendarEvent[]>;
  getCalendarEventsByContactId(contactId: string): Promise<CalendarEvent[]>;
  getCalendarEventByGoogleId(userId: string, googleEventId: string): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  getUnprocessedCalendarEvents(userId: string): Promise<CalendarEvent[]>;
  markCalendarEventProcessed(id: string, extractedData: any): Promise<CalendarEvent>;
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

  async getContactsByUserId(userId: string): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(desc(contacts.lastContact));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
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

  // Calendar Events - Mock implementation for now
  async getCalendarEvents(userId: string, month?: string): Promise<any[]> {
    // In a real implementation, this would fetch from Google Calendar API
    // For now, return sample events to demonstrate the UI
    const sampleEvents = [
      {
        id: '1',
        title: 'Wellness Session with Sarah',
        description: 'Weekly check-in and goal review',
        start: new Date(2025, 0, 30, 10, 0).toISOString(),
        end: new Date(2025, 0, 30, 11, 0).toISOString(),
        location: 'Wellness Center Room 1',
        meetingType: 'in-person',
        contactId: '1',
        contact: { id: '1', name: 'Sarah Johnson', avatar: null },
      },
      {
        id: '2',
        title: 'Virtual Consultation',
        description: 'Initial consultation call',
        start: new Date(2025, 0, 31, 14, 30).toISOString(),
        end: new Date(2025, 0, 31, 15, 30).toISOString(),
        location: 'Zoom Meeting',
        meetingType: 'video',
        contactId: '2',
        contact: { id: '2', name: 'Mike Chen', avatar: null },
      },
    ];
    return sampleEvents;
  }

  async createUICalendarEvent(event: any): Promise<any> {
    // In a real implementation, this would create an event via Google Calendar API
    // For now, return the event with an ID
    return {
      ...event,
      id: `event_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
  }

  // Email Management - Mock implementation for now
  async getEmails(userId: string, folder: string): Promise<any[]> {
    // In a real implementation, this would fetch from Gmail API
    // For now, return sample emails to demonstrate the UI
    const sampleEmails = [
      {
        id: '1',
        subject: 'Thank you for the wellness session',
        from: {
          name: 'Sarah Johnson',
          email: 'sarah.johnson@email.com',
          avatar: null,
        },
        to: [{ name: 'You', email: 'you@example.com' }],
        body: '<p>Hi,</p><p>I wanted to thank you for the amazing wellness session yesterday. I feel much more motivated to reach my health goals!</p><p>Best regards,<br>Sarah</p>',
        snippet: 'I wanted to thank you for the amazing wellness session yesterday...',
        timestamp: new Date(2025, 0, 29, 15, 30).toISOString(),
        isRead: false,
        isStarred: true,
        hasAttachments: false,
        labels: ['inbox'],
        contactId: '1',
        contact: { id: '1', name: 'Sarah Johnson', avatar: null },
      },
      {
        id: '2',
        subject: 'Question about meal planning',
        from: {
          name: 'Mike Chen',
          email: 'mike.chen@email.com',
          avatar: null,
        },
        to: [{ name: 'You', email: 'you@example.com' }],
        body: '<p>Hello,</p><p>I had a question about the meal planning we discussed. Could you send me those healthy recipe suggestions you mentioned?</p><p>Thanks!<br>Mike</p>',
        snippet: 'I had a question about the meal planning we discussed...',
        timestamp: new Date(2025, 0, 29, 9, 15).toISOString(),
        isRead: true,
        isStarred: false,
        hasAttachments: false,
        labels: ['inbox'],
        contactId: '2',
        contact: { id: '2', name: 'Mike Chen', avatar: null },
      },
    ];

    return sampleEmails.filter((email) => {
      if (folder === 'starred') return email.isStarred;
      if (folder === 'inbox') return email.labels.includes('inbox');
      return true;
    });
  }

  async sendEmail(emailData: any): Promise<any> {
    // In a real implementation, this would send via Gmail API
    // For now, return success response
    return {
      id: `sent_${Date.now()}`,
      ...emailData,
      timestamp: new Date().toISOString(),
      sent: true,
    };
  }

  async markEmailAsRead(emailId: string): Promise<boolean> {
    // In a real implementation, this would update via Gmail API
    return true;
  }

  async toggleEmailStar(emailId: string): Promise<boolean> {
    // In a real implementation, this would update via Gmail API
    return true;
  }

  async moveEmail(emailId: string, folder: string): Promise<boolean> {
    // In a real implementation, this would move via Gmail API
    return true;
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

  async getCalendarEventByGoogleId(userId: string, googleEventId: string): Promise<CalendarEvent | undefined> {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.userId, userId),
        eq(calendarEvents.googleEventId, googleEventId)
      ));
    return event || undefined;
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(calendarEvents).values(insertEvent).returning();
    return event;
  }

  async updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
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
      .where(and(
        eq(calendarEvents.userId, userId),
        eq(calendarEvents.processed, false)
      ))
      .orderBy(desc(calendarEvents.startTime));
  }

  async markCalendarEventProcessed(id: string, extractedData: any): Promise<CalendarEvent> {
    const [event] = await db
      .update(calendarEvents)
      .set({ 
        processed: true, 
        extractedData,
        updatedAt: new Date() 
      })
      .where(eq(calendarEvents.id, id))
      .returning();
    return event;
  }
}

export const storage = new DatabaseStorage();
