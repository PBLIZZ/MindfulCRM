import { z } from 'zod';

// Schema for creating tasks
export const createTaskSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().or(z.date().optional()),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  owner: z.enum(['user', 'ai_assistant']).default('user'),
  projectId: z.string().uuid().optional(),
  contactIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Schema for updating tasks (all fields optional for PATCH)
export const updateTaskSchema = createTaskSchema.partial();

// Schema for task query parameters
export const taskQuerySchema = z.object({
  status: z.string().optional(), // Can be comma-separated list
  project: z.string().uuid().optional(),
  owner: z.enum(['user', 'ai_assistant']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Schema for AI task delegation
export const delegateTaskSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  contactIds: z.array(z.string().uuid()).default([]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().datetime().optional().or(z.date().optional()),
  metadata: z.record(z.unknown()).optional(),
});

// Schema for bulk task creation
export const bulkCreateTaskSchema = z.object({
  csvData: z.string().min(1, { message: "CSV data is required" }),
  fileName: z.string().min(1, { message: "File name is required" }),
  mapping: z.record(z.string()).optional(), // Column mapping
});

// Schema for task completion
export const completeTaskSchema = z.object({
  completedAt: z.string().datetime().optional().or(z.date().optional()),
  notes: z.string().optional(),
});

// Inferred TypeScript types
export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type TaskQueryDto = z.infer<typeof taskQuerySchema>;
export type DelegateTaskDto = z.infer<typeof delegateTaskSchema>;
export type BulkCreateTaskDto = z.infer<typeof bulkCreateTaskSchema>;
export type CompleteTaskDto = z.infer<typeof completeTaskSchema>;