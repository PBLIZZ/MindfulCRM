-- Migration: Add processed events table for deduplication
-- This table tracks which calendar events have been processed by the LLM
-- to avoid reprocessing unchanged events and manage costs

CREATE TABLE IF NOT EXISTS "processed_events" (
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

-- Add foreign key constraint to calendar_events
ALTER TABLE "processed_events" ADD CONSTRAINT "processed_events_event_id_calendar_events_id_fk" 
FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "processed_events_event_id_idx" ON "processed_events" ("event_id");
CREATE INDEX IF NOT EXISTS "processed_events_processed_at_idx" ON "processed_events" ("processed_at");
CREATE INDEX IF NOT EXISTS "processed_events_is_relevant_idx" ON "processed_events" ("is_relevant");
CREATE INDEX IF NOT EXISTS "processed_events_event_hash_idx" ON "processed_events" ("event_hash");