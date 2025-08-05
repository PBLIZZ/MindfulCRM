import { z } from 'zod';

// Schema for creating tags
export const createTagSchema = z.object({
  name: z.string().min(1, { message: "Tag name is required" }).max(50, { message: "Tag name must be less than 50 characters" }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: "Color must be a valid hex color code" }).optional(),
  description: z.string().max(200, { message: "Description must be less than 200 characters" }).optional(),
});

// Schema for updating tags (all fields optional for PATCH)
export const updateTagSchema = createTagSchema.partial();

// Schema for tag assignment to contacts
export const assignTagSchema = z.object({
  contactId: z.string().uuid({ message: "Valid contact ID is required" }),
  tagId: z.string().uuid({ message: "Valid tag ID is required" }),
});

// Schema for bulk tag operations
export const bulkTagOperationSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1, { message: "At least one contact ID is required" }),
  tagIds: z.array(z.string().uuid()).min(1, { message: "At least one tag ID is required" }),
  operation: z.enum(['assign', 'remove'], { message: "Operation must be 'assign' or 'remove'" }),
});

// Schema for tag query parameters
export const tagQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Inferred TypeScript types
export type CreateTagDto = z.infer<typeof createTagSchema>;
export type UpdateTagDto = z.infer<typeof updateTagSchema>;
export type AssignTagDto = z.infer<typeof assignTagSchema>;
export type BulkTagOperationDto = z.infer<typeof bulkTagOperationSchema>;
export type TagQueryDto = z.infer<typeof tagQuerySchema>;