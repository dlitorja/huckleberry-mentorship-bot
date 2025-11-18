-- Video Calls Table
-- Creates: video_calls table and indexes for tracking video call sessions

-- Enable UUID extension if not already enabled (safe to run if exists)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Video call history table
CREATE TABLE IF NOT EXISTS video_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentorship_id UUID NOT NULL REFERENCES mentorships(id) ON DELETE CASCADE,
    instructor_id UUID REFERENCES instructors(id),
    mentee_id UUID REFERENCES mentees(id),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'ended', 'failed'
    participants JSONB, -- Store participant info (Discord IDs, roles, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_calls_mentorship ON video_calls(mentorship_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_start_time ON video_calls(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);
CREATE INDEX IF NOT EXISTS idx_video_calls_instructor ON video_calls(instructor_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_mentee ON video_calls(mentee_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_video_calls_updated_at
    BEFORE UPDATE ON video_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_video_calls_updated_at();

-- Comments
COMMENT ON TABLE video_calls IS 'Tracks video call sessions between instructors and students';
COMMENT ON COLUMN video_calls.status IS 'Call status: active, ended, or failed';
COMMENT ON COLUMN video_calls.participants IS 'JSON object storing participant information (Discord IDs, roles, join times)';

