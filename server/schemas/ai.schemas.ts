import { z } from 'zod';

/**
 * Schema for photo enrichment request body
 * Used when applying a specific photo suggestion to a contact
 */
export const enrichPhotoSchema = z.object({
  photoUrl: z.string().url('Invalid photo URL'),
  source: z.enum([
    'linkedin',
    'gravatar', 
    'clearbit',
    'ai_generated',
    'facebook',
    'twitter',
    'instagram',
    'github'
  ]),
  metadata: z.object({
    size: z.object({
      width: z.number(),
      height: z.number()
    }).optional(),
    format: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    description: z.string().optional()
  }).optional()
});

export type EnrichPhotoRequest = z.infer<typeof enrichPhotoSchema>;