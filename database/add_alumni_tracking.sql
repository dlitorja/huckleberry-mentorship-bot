-- Alumni Tracking - Add columns and create export view
-- Run this in your Supabase SQL editor

-- Add optional tracking columns to mentorships table
ALTER TABLE mentorships
ADD COLUMN IF NOT EXISTS returned_after_end BOOLEAN DEFAULT false;

ALTER TABLE mentorships
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create alumni export view for easy CSV exports
CREATE OR REPLACE VIEW alumni_export AS
SELECT 
  -- Contact Info
  mentees.email,
  mentees.discord_id,
  
  -- Instructor
  instructors.name AS instructor_name,
  instructors.discord_id AS instructor_discord_id,
  
  -- Session Stats
  mentorships.total_sessions,
  mentorships.sessions_remaining,
  (mentorships.total_sessions - mentorships.sessions_remaining) AS sessions_completed,
  
  -- Timing
  mentorships.ended_at,
  TO_CHAR(mentorships.ended_at, 'YYYY-MM-DD') AS ended_date_formatted,
  ROUND(EXTRACT(EPOCH FROM (NOW() - mentorships.ended_at)) / 2592000) AS months_since_ended,
  
  -- Context
  mentorships.end_reason,
  mentorships.last_session_date,
  TO_CHAR(mentorships.last_session_date, 'YYYY-MM-DD') AS last_session_formatted,
  
  -- Tracking
  mentorships.returned_after_end,
  mentorships.admin_notes,
  
  -- IDs (for reference)
  mentorships.id AS mentorship_id,
  mentees.id AS mentee_id,
  instructors.id AS instructor_id,
  
  -- Timestamps
  mentorships.created_at AS mentorship_started_at
  
FROM mentorships
JOIN mentees ON mentorships.mentee_id = mentees.id
JOIN instructors ON mentorships.instructor_id = instructors.id
WHERE mentorships.status = 'ended'
ORDER BY mentorships.ended_at DESC;

-- Grant access to view (if needed)
-- GRANT SELECT ON alumni_export TO authenticated;

-- You're done! Now you can:
-- 1. Go to Supabase Table Editor → Views → alumni_export
-- 2. Apply filters as needed
-- 3. Click Export → Download CSV
-- 4. Import CSV to Kajabi for email campaigns

