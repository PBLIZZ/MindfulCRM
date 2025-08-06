import { z } from 'zod';

// Zod schema for creating contacts
export const createContactSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Valid email is required" }),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  lastContact: z.date().optional(),
  sentiment: z.number().int().min(1).max(5).optional(),
  engagementTrend: z.enum(['improving', 'stable', 'declining']).optional(),
  status: z.string().default('active'),
  notes: z.string().optional(),
  lifecycleStage: z.enum([
    'discovery',
    'curious',
    'new_client',
    'core_client',
    'ambassador',
    'needs_reconnecting',
    'inactive',
    'collaborator'
  ]).optional(),
  extractedFields: z.record(z.unknown()).optional(),
  revenueData: z.record(z.unknown()).optional(),
  referralCount: z.number().int().min(0).default(0),
  hasGdprConsent: z.boolean().default(false),
  gdprConsentFormPath: z.string().optional(),
  socialMediaHandles: z.record(z.string()).optional(),
  profilePictureSource: z.enum([
    'linkedin',
    'facebook',
    'x',
    'instagram',
    'github',
    'client_provided',
    'ai_generated'
  ]).optional(),
  profilePictureScrapedAt: z.date().optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
});

// Zod schema for updating contacts (all fields optional for PATCH)
export const updateContactSchema = createContactSchema.partial();

// Inferred TypeScript types from Zod schemas
export type CreateContactDto = z.infer<typeof createContactSchema>;
export type UpdateContactDto = z.infer<typeof updateContactSchema>;

// Schema for contact query parameters
export const contactQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.string().optional(),
  lifecycleStage: z.enum([
    'discovery',
    'curious',
    'new_client',
    'core_client',
    'ambassador',
    'needs_reconnecting',
    'inactive',
    'collaborator'
  ]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ContactQueryDto = z.infer<typeof contactQuerySchema>;
