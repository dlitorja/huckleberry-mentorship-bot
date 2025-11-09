-- Add session notes functionality
-- Run this in your Supabase SQL Editor

-- Create session_notes table
CREATE TABLE IF NOT EXISTS session_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentorship_id UUID NOT NULL REFERENCES mentorships(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  notes TEXT,
  created_by_discord_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create session_links table (for resource links)
CREATE TABLE IF NOT EXISTS session_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_note_id UUID NOT NULL REFERENCES session_notes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_session_notes_mentorship ON session_notes(mentorship_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_date ON session_notes(session_date);
CREATE INDEX IF NOT EXISTS idx_session_links_note ON session_links(session_note_id);

-- Add comments
COMMENT ON TABLE session_notes IS 'Notes for each mentorship session';
COMMENT ON TABLE session_links IS 'Resource links shared during sessions';
COMMENT ON COLUMN session_notes.created_by_discord_id IS 'Discord ID of who created the note (instructor or student)';

