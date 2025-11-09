-- Add status tracking to mentorships table
-- Run this in your Supabase SQL editor

-- Add status column to track mentorship state
ALTER TABLE mentorships 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add ended_at timestamp
ALTER TABLE mentorships 
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP WITH TIME ZONE;

-- Add end_reason to track why mentorship ended
ALTER TABLE mentorships 
ADD COLUMN IF NOT EXISTS end_reason TEXT;

-- Add constraint to ensure status is one of the allowed values
ALTER TABLE mentorships 
ADD CONSTRAINT mentorship_status_check 
CHECK (status IN ('active', 'ended', 'cancelled'));

-- Create index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_mentorships_status ON mentorships(status);

-- Update existing records to have 'active' status
UPDATE mentorships 
SET status = 'active' 
WHERE status IS NULL;

