-- Migration: Add calendar_events table for storing raw Google Calendar data
-- This allows us to store complete event data and process it with LLM

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL UNIQUE,
  raw_data JSONB NOT NULL, -- Complete Google Calendar event JSON
  summary TEXT,
  description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  attendees JSONB, -- Array of attendee objects
  location TEXT,
  meeting_type TEXT, -- 'in-person', 'video', 'phone'
  processed BOOLEAN DEFAULT FALSE, -- Whether LLM has processed this event
  extracted_data JSONB, -- LLM-extracted insights
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL, -- Associated contact if identified
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event_id ON calendar_events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_processed ON calendar_events(processed);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact_id ON calendar_events(contact_id);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();

-- Add comments for documentation
COMMENT ON TABLE calendar_events IS 'Stores raw Google Calendar events for LLM processing and client timeline generation';
COMMENT ON COLUMN calendar_events.raw_data IS 'Complete Google Calendar API response for this event';
COMMENT ON COLUMN calendar_events.processed IS 'Whether this event has been analyzed by the LLM processor';
COMMENT ON COLUMN calendar_events.extracted_data IS 'LLM-extracted insights including event type, client relations, topics, etc.';
COMMENT ON COLUMN calendar_events.meeting_type IS 'Inferred meeting type: in-person, video, or phone';
