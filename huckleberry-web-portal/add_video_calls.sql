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
    recording_status TEXT, -- 'not_recorded', 'recording', 'recorded', 'failed'
    recording_url TEXT, -- URL to the recorded video file
    recording_key TEXT, -- Key for the recorded video in storage (e.g., Backblaze B2)
    recording_size BIGINT, -- Size of the recorded video in bytes
    recording_duration_seconds INTEGER, -- Duration of the recorded video
    recording_metadata JSONB, -- Additional metadata about the recording
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_calls_mentorship ON video_calls(mentorship_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_start_time ON video_calls(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);
CREATE INDEX IF NOT EXISTS idx_video_calls_instructor ON video_calls(instructor_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_mentee ON video_calls(mentee_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_recording_status ON video_calls(recording_status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
-- Drop trigger if it exists (for idempotent migrations)
DROP TRIGGER IF EXISTS trigger_update_video_calls_updated_at ON video_calls;

CREATE TRIGGER trigger_update_video_calls_updated_at
    BEFORE UPDATE ON video_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_video_calls_updated_at();

-- Comments
COMMENT ON TABLE video_calls IS 'Tracks video call sessions between instructors and students';
COMMENT ON COLUMN video_calls.status IS 'Call status: active, ended, or failed';
COMMENT ON COLUMN video_calls.participants IS 'JSON object storing participant information (Discord IDs, roles, join times)';
COMMENT ON COLUMN video_calls.recording_status IS 'Recording status: not_recorded, recording, recorded, or failed';
COMMENT ON COLUMN video_calls.recording_url IS 'Public URL to the recorded video';
COMMENT ON COLUMN video_calls.recording_key IS 'Storage key for the recorded video file';
COMMENT ON COLUMN video_calls.recording_size IS 'Size of the recorded video in bytes';
COMMENT ON COLUMN video_calls.recording_duration_seconds IS 'Duration of the recorded video';

