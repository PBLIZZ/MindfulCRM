import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, uuid, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const lifecycleStageEnum = pgEnum('lifecycle_stage', [
  'discovery',
  'curious', 
  'new_client',
  'core_client',
  'ambassador',
  'needs_reconnecting',
  'inactive',
  'collaborator'
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  picture: text("picture"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  lastContact: timestamp("last_contact"),
  sentiment: integer("sentiment"), // 1-5 rating
  engagementTrend: text("engagement_trend"), // improving, stable, declining
  status: text("status").default("active"), // active, inactive, archived
  notes: text("notes"),
  lifecycleStage: lifecycleStageEnum("lifecycle_stage"),
  extractedFields: jsonb("extracted_fields"),
  revenueData: jsonb("revenue_data"),
  referralCount: integer("referral_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const interactions = pgTable("interactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  type: text("type").notNull(), // email, meeting, note, call
  subject: text("subject"),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  source: text("source"), // gmail, calendar, manual
  sourceId: text("source_id"), // external ID from Google services
  sentiment: integer("sentiment"), // 1-5 rating
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").default(0).notNull(),
  unit: text("unit").notNull(), // lbs, sessions, weeks, etc.
  status: text("status").default("active"), // active, completed, paused
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // pdf, docx, txt
  content: text("content"), // extracted text content
  driveId: text("drive_id"), // Google Drive file ID
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const syncStatus = pgTable("sync_status", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  service: text("service").notNull(), // gmail, calendar, drive
  lastSync: timestamp("last_sync").defaultNow().notNull(),
  status: text("status").default("success"), // success, error, pending
  error: text("error"),
});

// Raw Google Calendar events storage
export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  googleEventId: text("google_event_id").notNull().unique(),
  rawData: jsonb("raw_data").notNull(), // Full Google Calendar event JSON
  summary: text("summary"),
  description: text("description"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  attendees: jsonb("attendees"), // Array of attendee objects
  location: text("location"),
  meetingType: text("meeting_type"), // in-person, video, phone
  processed: boolean("processed").default(false), // Whether LLM has processed this event
  extractedData: jsonb("extracted_data"), // LLM-extracted insights
  contactId: uuid("contact_id").references(() => contacts.id), // Associated contact if identified
  // Calendar metadata
  calendarId: text("calendar_id"), // Google Calendar ID
  calendarName: text("calendar_name"), // Calendar display name (e.g., "Personal", "Business")
  calendarColor: text("calendar_color"), // Calendar color from Google
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Additional Tables
export const aiActions = pgTable("ai_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  actionType: text("action_type").notNull(),
  status: text("status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const voiceNotes = pgTable("voice_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  noteUrl: text("note_url").notNull(),
  transcription: text("transcription"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactGroups = pgTable("contact_groups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactPhotos = pgTable("contact_photos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes
  mimeType: text("mime_type").notNull(),
  source: text("source").default("manual").notNull(), // manual, ai_enrichment
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color").default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactTags = pgTable("contact_tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  tagId: uuid("tag_id").references(() => tags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
  syncStatus: many(syncStatus),
  calendarEvents: many(calendarEvents),
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

// Types
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
