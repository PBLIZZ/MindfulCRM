import { db } from '../db.js';
import {
  calendarEvents,
  processedEvents,
  type CalendarEvent,
  type InsertCalendarEvent,
  type ProcessedEvent,
  type InsertProcessedEvent,
} from '../../shared/schema.js';
import type { CalendarEventAnalysis } from '../types/service-contracts.js';
import { eq, desc, and } from 'drizzle-orm';
import crypto from 'crypto';

export class CalendarData {
  async getByUserId(userId: string, limit: number = 100): Promise<CalendarEvent[]> {
    return db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.userId, userId))
      .orderBy(desc(calendarEvents.startTime))
      .limit(limit);
  }

  async getByContactId(contactId: string): Promise<CalendarEvent[]> {
    return db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.contactId, contactId))
      .orderBy(desc(calendarEvents.startTime));
  }

  async findByGoogleId(userId: string, googleEventId: string): Promise<CalendarEvent | undefined> {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(eq(calendarEvents.userId, userId), eq(calendarEvents.googleEventId, googleEventId))
      );
    return event;
  }

  async create(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(calendarEvents).values(insertEvent).returning();
    return event;
  }

  async update(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const [event] = await db
      .update(calendarEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return event;
  }

  async getUnprocessed(userId: string): Promise<CalendarEvent[]> {
    return db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.processed, false)))
      .orderBy(desc(calendarEvents.startTime));
  }

  // --- Processed Events for Deduplication ---

  getEventHash(event: CalendarEvent): string {
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

  async findProcessedEvent(eventId: string): Promise<ProcessedEvent | undefined> {
    const [processedEvent] = await db
      .select()
      .from(processedEvents)
      .where(eq(processedEvents.eventId, eventId));
    return processedEvent;
  }

  async markEventProcessed(
    eventId: string,
    eventHash: string,
    isRelevant: boolean,
    analysis?: CalendarEventAnalysis,
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

  async shouldProcessEvent(eventId: string): Promise<boolean> {
    const processedEvent = await this.findProcessedEvent(eventId);
    return !processedEvent;
  }
}
