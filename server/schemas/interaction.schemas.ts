import { z } from 'zod';

// Zod schema for creating interactions
export const createInteractionSchema = z.object({
  contactId: z.string().uuid({ message: "Valid contact ID is required" }),
  type: z.enum(['email', 'call', 'meeting', 'note', 'task', 'other'], {
    errorMap: () => ({ message: "Type must be one of: email, call, meeting, note, task, other" })
  }),
  content: z.string().min(1, { message: "Content is required" }).max(5000, { message: "Content must be less than 5000 characters" }),
  subject: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.date().default(() => new Date()),
  sentiment: z.number().int().min(1).max(5).optional(),
  importance: z.enum(['low', 'medium', 'high']).default('medium'),
  tags: z.array(z.string()).optional(),
});

// Zod schema for updating interactions
export const updateInteractionSchema = createInteractionSchema.partial();

// Inferred TypeScript types
export type CreateInteractionDto = z.infer<typeof createInteractionSchema>;
export type UpdateInteractionDto = z.infer<typeof updateInteractionSchema>;

// Schema for interaction query parameters
export const interactionQuerySchema = z.object({
  contactId: z.string().uuid().optional(),
  type: z.enum(['email', 'call', 'meeting', 'note', 'task', 'other']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type InteractionQueryDto = z.infer<typeof interactionQuerySchema>;
