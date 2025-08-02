import { sql, relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  boolean,
  uuid,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums
export const lifecycleStageEnum = pgEnum('lifecycle_stage', [
  'discovery',
  'curious',
  'new_client',
  'core_client',
  'ambassador',
  'needs_reconnecting',
  'inactive',
  'collaborator',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'waiting_approval',
]);

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);

export const taskOwnerEnum = pgEnum('task_owner', ['user', 'ai_assistant']);

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  picture: text('picture'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  // GDPR Consent for profile picture scraping
  allowProfilePictureScraping: boolean('allow_profile_picture_scraping').default(false),
  gdprConsentDate: timestamp('gdpr_consent_date'),
  gdprConsentVersion: text('gdpr_consent_version').default('1.0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  lastContact: timestamp('last_contact'),
  sentiment: integer('sentiment'), // 1-5 rating
  engagementTrend: text('engagement_trend'), // improving, stable, declining
  status: text('status').default('active'), // active, inactive, archived
  notes: text('notes'),
  lifecycleStage: lifecycleStageEnum('lifecycle_stage'),
  extractedFields: jsonb('extracted_fields'),
  revenueData: jsonb('revenue_data'),
  referralCount: integer('referral_count').default(0),
  // GDPR consent and profile picture scraping
  hasGdprConsent: boolean('has_gdpr_consent').default(false),
  gdprConsentFormPath: text('gdpr_consent_form_path'), // Path to signed consent form
  socialMediaHandles: jsonb('social_media_handles'), // LinkedIn, Facebook, X, Instagram, GitHub URLs
  profilePictureSource: text('profile_picture_source'), // linkedin, facebook, x, instagram, github, client_provided, ai_generated
  profilePictureScrapedAt: timestamp('profile_picture_scraped_at'),
  sex: text('sex'), // male, female, other - for fallback avatar selection
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const interactions = pgTable('interactions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id')
    .references(() => contacts.id)
    .notNull(),
  type: text('type').notNull(), // email, meeting, note, call
  subject: text('subject'),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  source: text('source'), // gmail, calendar, manual
  sourceId: text('source_id'), // external ID from Google services
  sentiment: integer('sentiment'), // 1-5 rating
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const goals = pgTable('goals', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id')
    .references(() => contacts.id)
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  targetValue: integer('target_value').notNull(),
  currentValue: integer('current_value').default(0).notNull(),
  unit: text('unit').notNull(), // lbs, sessions, weeks, etc.
  status: text('status').default('active'), // active, completed, paused
  deadline: timestamp('deadline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id')
    .references(() => contacts.id)
    .notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // pdf, docx, txt
  content: text('content'), // extracted text content
  driveId: text('drive_id'), // Google Drive file ID
  url: text('url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const syncStatus = pgTable('sync_status', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  service: text('service').notNull(), // gmail, calendar, drive
  lastSync: timestamp('last_sync').defaultNow().notNull(),
  status: text('status').default('success'), // success, error, pending
  error: text('error'),
});

// Raw Google Calendar events storage
export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  googleEventId: text('google_event_id').notNull().unique(),
  rawData: jsonb('raw_data').notNull(), // Full Google Calendar event JSON
  summary: text('summary'),
  description: text('description'),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  attendees: jsonb('attendees'), // Array of attendee objects
  location: text('location'),
  meetingType: text('meeting_type'), // in-person, video, phone
  processed: boolean('processed').default(false), // Whether LLM has processed this event
  extractedData: jsonb('extracted_data'), // LLM-extracted insights
  contactId: uuid('contact_id').references(() => contacts.id), // Associated contact if identified
  // Calendar metadata
  calendarId: text('calendar_id'), // Google Calendar ID
  calendarName: text('calendar_name'), // Calendar display name (e.g., "Personal", "Business")
  calendarColor: text('calendar_color'), // Calendar color from Google
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Raw Gmail emails storage (filtered business-relevant emails only)
export const emails = pgTable(
  'emails',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    gmailMessageId: text('gmail_message_id').notNull().unique(),
    gmailThreadId: text('gmail_thread_id').notNull(),
    rawData: jsonb('raw_data').notNull(), // Full Gmail message JSON
    subject: text('subject'),
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    toEmails: jsonb('to_emails'), // Array of recipient objects
    ccEmails: jsonb('cc_emails'), // Array of CC recipient objects
    bccEmails: jsonb('bcc_emails'), // Array of BCC recipient objects
    bodyText: text('body_text'), // Plain text body
    bodyHtml: text('body_html'), // HTML body
    snippet: text('snippet'), // Gmail snippet
    timestamp: timestamp('timestamp').notNull(), // Email sent/received time
    isRead: boolean('is_read').default(false),
    hasAttachments: boolean('has_attachments').default(false),
    attachments: jsonb('attachments'), // Array of attachment metadata
    labels: jsonb('labels'), // Gmail labels array
    category: text('category'), // Gmail category (primary, promotions, etc.)
    processed: boolean('processed').default(false), // Whether LLM has processed this email
    extractedData: jsonb('extracted_data'), // LLM-extracted insights
    contactId: uuid('contact_id').references(() => contacts.id), // Associated contact if identified
    relevanceScore: integer('relevance_score'), // 1-10 business relevance score
    filterReason: text('filter_reason'), // Why this email was included (for debugging)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('emails_user_id_idx').on(table.userId),
    timestampIdx: index('emails_timestamp_idx').on(table.timestamp),
    processedIdx: index('emails_processed_idx').on(table.processed),
    contactIdIdx: index('emails_contact_id_idx').on(table.contactId),
  })
);

// Additional Tables
export const aiActions = pgTable('ai_actions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id')
    .references(() => contacts.id)
    .notNull(),
  actionType: text('action_type').notNull(),
  status: text('status').default('pending'), // pending, approved, rejected
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

export const voiceNotes = pgTable('voice_notes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id')
    .references(() => contacts.id)
    .notNull(),
  noteUrl: text('note_url').notNull(),
  transcription: text('transcription'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contactGroups = pgTable('contact_groups', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contactPhotos = pgTable('contact_photos', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id')
    .references(() => contacts.id)
    .notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(), // Size in bytes
  mimeType: text('mime_type').notNull(),
  source: text('source').default('manual').notNull(), // manual, ai_enrichment
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tags = pgTable('tags', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  color: text('color').default('#3b82f6'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contactTags = pgTable('contact_tags', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id')
    .references(() => contacts.id)
    .notNull(),
  tagId: uuid('tag_id')
    .references(() => tags.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Processed Events - for deduplication and change tracking
export const processedEvents = pgTable('processed_events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: uuid('event_id')
    .references(() => calendarEvents.id)
    .notNull()
    .unique(),
  eventHash: text('event_hash').notNull(), // SHA-256 hash of key event properties
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  lastModified: timestamp('last_modified').notNull(),
  isRelevant: boolean('is_relevant').default(false).notNull(),
  analysis: jsonb('analysis'), // Stored LLM analysis result
  llmModel: text('llm_model'), // Which model was used
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Projects - for organizing related tasks
export const projects = pgTable('projects', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').default('#3b82f6'),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tasks - main task management table
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    projectId: uuid('project_id').references(() => projects.id),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').default('pending'),
    priority: taskPriorityEnum('priority').default('medium'),
    owner: taskOwnerEnum('owner').default('user'),
    dueDate: timestamp('due_date'),
    completedAt: timestamp('completed_at'),
    estimatedMinutes: integer('estimated_minutes'),
    actualMinutes: integer('actual_minutes'),
    assignedContactIds: jsonb('assigned_contact_ids'), // Array of contact UUIDs
    tags: jsonb('tags'), // Array of tag strings
    // AI-specific fields
    isAiGenerated: boolean('is_ai_generated').default(false),
    aiPrompt: text('ai_prompt'), // Original prompt that generated this task
    aiAnalysis: jsonb('ai_analysis'), // AI analysis and suggestions
    requiresApproval: boolean('requires_approval').default(false),
    approvedAt: timestamp('approved_at'),
    rejectedAt: timestamp('rejected_at'),
    rejectionReason: text('rejection_reason'),
    // Parent task relationship for subtasks
    parentTaskId: uuid('parent_task_id'),
    orderIndex: integer('order_index').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('tasks_user_id_idx').on(table.userId),
    projectIdIdx: index('tasks_project_id_idx').on(table.projectId),
    statusIdx: index('tasks_status_idx').on(table.status),
    ownerIdx: index('tasks_owner_idx').on(table.owner),
    dueDateIdx: index('tasks_due_date_idx').on(table.dueDate),
    parentTaskIdx: index('tasks_parent_task_idx').on(table.parentTaskId),
  })
);

// Task Activities - for tracking task progress and AI actions
export const taskActivities = pgTable(
  'task_activities',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    taskId: uuid('task_id')
      .references(() => tasks.id)
      .notNull(),
    actorType: text('actor_type').notNull(), // "user" or "ai_assistant"
    actorId: uuid('actor_id'), // user_id if user, null if AI
    actionType: text('action_type').notNull(), // "created", "updated", "completed", "ai_processed", etc.
    description: text('description'),
    metadata: jsonb('metadata'), // Additional action-specific data
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index('task_activities_task_id_idx').on(table.taskId),
    createdAtIdx: index('task_activities_created_at_idx').on(table.createdAt),
  })
);

// AI Suggestions - for HITL workflow
export const aiSuggestions = pgTable(
  'ai_suggestions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    type: text('type').notNull(), // "task_creation", "contact_update", "data_processing", etc.
    title: text('title').notNull(),
    description: text('description').notNull(),
    suggestedAction: jsonb('suggested_action').notNull(), // The action to be performed
    sourceData: jsonb('source_data'), // The raw data that triggered this suggestion
    aiAnalysis: jsonb('ai_analysis'), // AI reasoning and context
    priority: taskPriorityEnum('priority').default('medium'),
    status: text('status').default('pending'), // "pending", "approved", "rejected", "executed"
    reviewedAt: timestamp('reviewed_at'),
    executedAt: timestamp('executed_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('ai_suggestions_user_id_idx').on(table.userId),
    statusIdx: index('ai_suggestions_status_idx').on(table.status),
    typeIdx: index('ai_suggestions_type_idx').on(table.type),
    createdAtIdx: index('ai_suggestions_created_at_idx').on(table.createdAt),
  })
);

// Data Processing Jobs - for tracking background AI processing
export const dataProcessingJobs = pgTable(
  'data_processing_jobs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    jobType: text('job_type').notNull(), // "attendance_csv", "photo_gdpr", "email_analysis", etc.
    sourceType: text('source_type').notNull(), // "google_drive", "gmail", "manual_upload", etc.
    sourceReference: text('source_reference'), // File path, email ID, etc.
    status: text('status').default('pending'), // "pending", "processing", "completed", "failed"
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
    inputData: jsonb('input_data'),
    outputData: jsonb('output_data'),
    suggestionsGenerated: integer('suggestions_generated').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('data_processing_jobs_user_id_idx').on(table.userId),
    statusIdx: index('data_processing_jobs_status_idx').on(table.status),
    jobTypeIdx: index('data_processing_jobs_job_type_idx').on(table.jobType),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
  syncStatus: many(syncStatus),
  calendarEvents: many(calendarEvents),
  emails: many(emails),
  projects: many(projects),
  tasks: many(tasks),
  aiSuggestions: many(aiSuggestions),
  dataProcessingJobs: many(dataProcessingJobs),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
  interactions: many(interactions),
  goals: many(goals),
  documents: many(documents),
  aiActions: many(aiActions),
  voiceNotes: many(voiceNotes),
  photos: many(contactPhotos),
  contactTags: many(contactTags),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  contact: one(contacts, {
    fields: [interactions.contactId],
    references: [contacts.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  contact: one(contacts, {
    fields: [goals.contactId],
    references: [contacts.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  contact: one(contacts, {
    fields: [documents.contactId],
    references: [contacts.id],
  }),
}));

export const syncStatusRelations = relations(syncStatus, ({ one }) => ({
  user: one(users, {
    fields: [syncStatus.userId],
    references: [users.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  contact: one(contacts, {
    fields: [calendarEvents.contactId],
    references: [contacts.id],
  }),
}));

export const emailsRelations = relations(emails, ({ one }) => ({
  user: one(users, {
    fields: [emails.userId],
    references: [users.id],
  }),
  contact: one(contacts, {
    fields: [emails.contactId],
    references: [contacts.id],
  }),
}));

export const aiActionsRelations = relations(aiActions, ({ one }) => ({
  contact: one(contacts, {
    fields: [aiActions.contactId],
    references: [contacts.id],
  }),
}));

export const voiceNotesRelations = relations(voiceNotes, ({ one }) => ({
  contact: one(contacts, {
    fields: [voiceNotes.contactId],
    references: [contacts.id],
  }),
}));

export const contactPhotosRelations = relations(contactPhotos, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactPhotos.contactId],
    references: [contacts.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  contactTags: many(contactTags),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, {
    fields: [contactTags.tagId],
    references: [tags.id],
  }),
}));

export const processedEventsRelations = relations(processedEvents, ({ one }) => ({
  calendarEvent: one(calendarEvents, {
    fields: [processedEvents.eventId],
    references: [calendarEvents.id],
  }),
}));

// Task management relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, {
    relationName: 'subtasks',
  }),
  activities: many(taskActivities),
}));

export const taskActivitiesRelations = relations(taskActivities, ({ one }) => ({
  task: one(tasks, {
    fields: [taskActivities.taskId],
    references: [tasks.id],
  }),
}));

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
  user: one(users, {
    fields: [aiSuggestions.userId],
    references: [users.id],
  }),
}));

export const dataProcessingJobsRelations = relations(dataProcessingJobs, ({ one }) => ({
  user: one(users, {
    fields: [dataProcessingJobs.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInteractionSchema = createInsertSchema(interactions).omit({
  id: true,
  createdAt: true,
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertSyncStatusSchema = createInsertSchema(syncStatus).omit({
  id: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Task management schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskActivitySchema = createInsertSchema(taskActivities).omit({
  id: true,
  createdAt: true,
});

export const insertAiSuggestionSchema = createInsertSchema(aiSuggestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataProcessingJobSchema = createInsertSchema(dataProcessingJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type SyncStatus = typeof syncStatus.$inferSelect;
export type InsertSyncStatus = z.infer<typeof insertSyncStatusSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;

// Task management types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type TaskActivity = typeof taskActivities.$inferSelect;
export type InsertTaskActivity = z.infer<typeof insertTaskActivitySchema>;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type InsertAiSuggestion = z.infer<typeof insertAiSuggestionSchema>;
export type DataProcessingJob = typeof dataProcessingJobs.$inferSelect;
export type InsertDataProcessingJob = z.infer<typeof insertDataProcessingJobSchema>;

export const insertAiActionSchema = createInsertSchema(aiActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceNoteSchema = createInsertSchema(voiceNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactGroupSchema = createInsertSchema(contactGroups).omit({
  id: true,
  createdAt: true,
});

export const insertContactPhotoSchema = createInsertSchema(contactPhotos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export const insertContactTagSchema = createInsertSchema(contactTags).omit({
  id: true,
  createdAt: true,
});

export const insertProcessedEventSchema = createInsertSchema(processedEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type AiAction = typeof aiActions.$inferSelect;
export type InsertAiAction = z.infer<typeof insertAiActionSchema>;
export type VoiceNote = typeof voiceNotes.$inferSelect;
export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
export type ContactGroup = typeof contactGroups.$inferSelect;
export type InsertContactGroup = z.infer<typeof insertContactGroupSchema>;
export type ContactPhoto = typeof contactPhotos.$inferSelect;
export type InsertContactPhoto = z.infer<typeof insertContactPhotoSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = z.infer<typeof insertContactTagSchema>;
export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type InsertProcessedEvent = z.infer<typeof insertProcessedEventSchema>;
