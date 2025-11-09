-- Add session tracking to mentorships table
-- Run this in your Supabase SQL Editor

-- Add last_session_date column
ALTER TABLE mentorships 
ADD COLUMN IF NOT EXISTS last_session_date TIMESTAMP WITH TIME ZONE;

-- Add comment
COMMENT ON COLUMN mentorships.last_session_date IS 'Date of the most recent session (manually tracked)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mentorships_last_session_date ON mentorships(last_session_date);

