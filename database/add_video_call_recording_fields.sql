-- Add Video Call Recording Fields
-- This migration adds recording-related columns to the video_calls table
-- Run this if you already have the video_calls table without recording fields

-- Add recording columns if they don't exist
ALTER TABLE video_calls 
ADD COLUMN IF NOT EXISTS recording_status TEXT, -- 'not_recorded', 'recording', 'recorded', 'failed'
ADD COLUMN IF NOT EXISTS recording_url TEXT, -- URL to the recorded video file
ADD COLUMN IF NOT EXISTS recording_key TEXT, -- Key for the recorded video in storage (e.g., Backblaze B2)
ADD COLUMN IF NOT EXISTS recording_size BIGINT, -- Size of the recorded video in bytes
ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER, -- Duration of the recorded video
ADD COLUMN IF NOT EXISTS recording_metadata JSONB; -- Additional metadata about the recording

-- Add index for recording status queries
CREATE INDEX IF NOT EXISTS idx_video_calls_recording_status ON video_calls(recording_status);

-- Add comments for documentation
COMMENT ON COLUMN video_calls.recording_status IS 'Recording status: not_recorded, recording, recorded, or failed';
COMMENT ON COLUMN video_calls.recording_url IS 'Public URL to the recorded video';
COMMENT ON COLUMN video_calls.recording_key IS 'Storage key for the recorded video file in Backblaze B2';
COMMENT ON COLUMN video_calls.recording_size IS 'Size of the recorded video in bytes';
COMMENT ON COLUMN video_calls.recording_duration_seconds IS 'Duration of the recorded video in seconds';
COMMENT ON COLUMN video_calls.recording_metadata IS 'Additional metadata about the recording (JSONB format)';

