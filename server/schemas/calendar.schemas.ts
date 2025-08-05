import { z } from 'zod';

// Schema for calendar sync request
export const calendarSyncSchema = z.object({
  startDate: z.string().datetime().optional().or(z.date().optional()),
  endDate: z.string().datetime().optional().or(z.date().optional()),
  syncType: z.enum(['initial', 'incremental', 'full']).default('incremental'),
  calendarIds: z.array(z.string()).optional(), // Specific calendar IDs to sync
});

// Schema for calendar sync request body
export const calendarSyncRequestSchema = z.object({
  months: z.number().int().min(1).max(24).default(12),
  useFreeModel: z.boolean().default(true),
});

// Schema for manual calendar event creation
export const createCalendarEventSchema = z.object({
  title: z.string().min(1, { message: "Event title is required" }),
  description: z.string().optional(),
  startTime: z.string().datetime().or(z.date()),
  endTime: z.string().datetime().or(z.date()),
  location: z.string().optional(),
  attendees: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).optional(),
  })).optional(),
  calendarId: z.string().optional(),
  eventType: z.enum(['session', 'consultation', 'workshop', 'meeting', 'other']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Schema for updating calendar events
export const updateCalendarEventSchema = createCalendarEventSchema.partial();

// Schema for calendar event query parameters
export const calendarEventQuerySchema = z.object({
  startDate: z.string().datetime().optional().or(z.date().optional()),
  endDate: z.string().datetime().optional().or(z.date().optional()),
  month: z.string().optional(),
  calendarId: z.string().optional(),
  eventType: z.enum(['session', 'consultation', 'workshop', 'meeting', 'other']).optional(),
  processed: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Schema for marking events as processed
export const markEventProcessedSchema = z.object({
  eventId: z.string().min(1, { message: "Event ID is required" }),
  processed: z.boolean().default(true),
  analysis: z.record(z.unknown()).optional(),
  model: z.string().optional(),
});

// Inferred TypeScript types
export type CalendarSyncDto = z.infer<typeof calendarSyncSchema>;
export type CreateCalendarEventDto = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventDto = z.infer<typeof updateCalendarEventSchema>;
export type CalendarEventQueryDto = z.infer<typeof calendarEventQuerySchema>;
export type MarkEventProcessedDto = z.infer<typeof markEventProcessedSchema>;