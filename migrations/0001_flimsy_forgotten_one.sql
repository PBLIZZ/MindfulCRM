CREATE TYPE "public"."lifecycle_stage" AS ENUM('discovery', 'curious', 'new_client', 'core_client', 'ambassador', 'needs_reconnecting', 'inactive', 'collaborator');--> statement-breakpoint
CREATE TYPE "public"."task_owner" AS ENUM('user', 'ai_assistant');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled', 'waiting_approval');--> statement-breakpoint
CREATE TABLE "ai_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"suggested_action" jsonb NOT NULL,
	"source_data" jsonb,
	"ai_analysis" jsonb,
	"priority" "task_priority" DEFAULT 'medium',
	"status" text DEFAULT 'pending',
	"reviewed_at" timestamp,
	"executed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "contact_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_reference" text,
	"status" text DEFAULT 'pending',
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"input_data" jsonb,
	"output_data" jsonb,
	"suggestions_generated" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gmail_message_id" text NOT NULL,
	"gmail_thread_id" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"subject" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_emails" jsonb,
	"cc_emails" jsonb,
	"bcc_emails" jsonb,
	"body_text" text,
	"body_html" text,
	"snippet" text,
	"timestamp" timestamp NOT NULL,
	"is_read" boolean DEFAULT false,
	"has_attachments" boolean DEFAULT false,
	"attachments" jsonb,
	"labels" jsonb,
	"category" text,
	"processed" boolean DEFAULT false,
	"extracted_data" jsonb,
	"contact_id" uuid,
	"relevance_score" integer,
	"filter_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emails_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"event_hash" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"last_modified" timestamp NOT NULL,
	"is_relevant" boolean DEFAULT false NOT NULL,
	"analysis" jsonb,
	"llm_model" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#3b82f6',
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "task_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"action_type" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'pending',
	"priority" "task_priority" DEFAULT 'medium',
	"owner" "task_owner" DEFAULT 'user',
	"due_date" timestamp,
	"completed_at" timestamp,
	"estimated_minutes" integer,
	"actual_minutes" integer,
	"assigned_contact_ids" jsonb,
	"tags" jsonb,
	"is_ai_generated" boolean DEFAULT false,
	"ai_prompt" text,
	"ai_analysis" jsonb,
	"requires_approval" boolean DEFAULT false,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"parent_task_id" uuid,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"note_url" text NOT NULL,
	"transcription" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "sentiment" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "engagement_trend" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "lifecycle_stage" "lifecycle_stage";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "extracted_fields" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "revenue_data" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "referral_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "has_gdpr_consent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "gdpr_consent_form_path" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "social_media_handles" jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "profile_picture_source" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "profile_picture_scraped_at" timestamp;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allow_profile_picture_scraping" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gdpr_consent_date" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gdpr_consent_version" text DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_photos" ADD CONSTRAINT "contact_photos_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_processing_jobs" ADD CONSTRAINT "data_processing_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_events" ADD CONSTRAINT "processed_events_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_suggestions_user_id_idx" ON "ai_suggestions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_suggestions_status_idx" ON "ai_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_suggestions_type_idx" ON "ai_suggestions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ai_suggestions_created_at_idx" ON "ai_suggestions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "data_processing_jobs_user_id_idx" ON "data_processing_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_processing_jobs_status_idx" ON "data_processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_processing_jobs_job_type_idx" ON "data_processing_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "emails_user_id_idx" ON "emails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "emails_timestamp_idx" ON "emails" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "emails_processed_idx" ON "emails" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "emails_contact_id_idx" ON "emails" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "task_activities_task_id_idx" ON "task_activities" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_activities_created_at_idx" ON "task_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_owner_idx" ON "tasks" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "tasks_parent_task_idx" ON "tasks" USING btree ("parent_task_id");