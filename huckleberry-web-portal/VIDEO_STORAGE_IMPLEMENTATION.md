# Video Storage Implementation with Backblaze B2 and Cloudflare

## Overview

This document outlines the implementation of video storage for the Huckleberry mentorship bot, using Backblaze B2 for storage and integrating with Cloudflare for cost-effective egress. The solution provides a complete video recording and storage system that leverages Backblaze B2's S3-compatible API and Cloudflare's CDN capabilities.

## Architecture

### Components

1. **Frontend Video Call Interface** (`components/VideoCall.tsx`)
   - Provides recording controls (start/stop)
   - Visual indicators for recording status
   - Integration with Agora Web SDK

2. **API Layer** (`app/api/video-call/recordings/route.ts`)
   - Manages recording lifecycle
   - Handles status updates
   - Integrates with recording service

3. **Recording Service** (`lib/agora/recording-service.ts`)
   - Orchestration of recording workflow
   - Session management
   - Integration between Agora and storage

4. **Agora Cloud Recording** (`lib/agora/cloud-recording.ts`)
   - Agora cloud recording API integration
   - S3-compatible storage configuration

5. **Backblaze B2 Storage** (`lib/storage/backblaze-b2.ts`)
   - S3-compatible API integration
   - Upload/download/delete operations
   - Signed URL generation

6. **Database Schema** (updated `video_calls` table)
   - Stores recording metadata
   - Tracks recording status
   - Links to stored video files

## Installation & Dependencies

The implementation requires the following additional dependencies:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner axios
npm install @types/axios  # if using TypeScript
```

## Configuration

### Environment Variables

Add the following variables to your `.env.local` file:

```
# Agora configuration
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate

# Backblaze B2 configuration
BACKBLAZE_B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
BACKBLAZE_B2_ACCESS_KEY_ID=your_access_key
BACKBLAZE_B2_SECRET_ACCESS_KEY=your_secret_key
BACKBLAZE_B2_BUCKET_NAME=your_bucket_name
```

## Database Schema Changes

The `video_calls` table has been extended with the following columns:

- `recording_status` (TEXT): Recording status ('not_recorded', 'recording', 'recorded', 'failed')
- `recording_url` (TEXT): Public URL to the recorded video
- `recording_key` (TEXT): Storage key for the video file in Backblaze B2
- `recording_size` (BIGINT): Size of the recorded video in bytes
- `recording_duration_seconds` (INTEGER): Duration of the recorded video
- `recording_metadata` (JSONB): Additional metadata about the recording

The corresponding migration file is in `database/add_video_calls.sql`.

## Features

### 1. Recording Controls
- Start/stop recording functionality in the video call interface
- Visual recording indicator in the UI
- Loading states during recording operations

### 2. Secure Storage
- Videos are stored in Backblaze B2 using S3-compatible API
- Signed URLs for secure temporary access
- Metadata tracking for each recording

### 3. Playback Interface
- Dedicated recordings page for each mentorship
- Displays recording metadata (duration, date, status)
- Watch and download functionality

### 4. Error Handling
- Comprehensive error handling throughout the recording workflow
- Fallback mechanisms for failed recordings
- Status tracking for troubleshooting

## API Endpoints

### GET /api/video-call/recordings
Retrieves recordings for a specific mentorship or call
- Query parameters:
  - `mentorshipId` (optional): Filter by mentorship ID
  - `callId` (optional): Filter by call ID
  - `includeSignedUrl` (optional): Include signed URLs for private access

### POST /api/video-call/recordings
Updates recording information or initiates cloud recording
- Request body:
  - `callId` (required): Video call ID
  - `recordingStatus`: New recording status
  - `recordingUrl`: URL to the recorded video
  - `recordingKey`: Storage key in Backblaze B2
  - `recordingSize`: File size in bytes
  - `recordingDuration`: Recording duration
  - `recordingMetadata`: Additional metadata
  - `channelName` and `uid`: For initiating cloud recording

## UI Components

### Video Call Interface
- Recording button with visual states (idle, recording, loading)
- "REC" indicator with pulsing animation during recording
- Integration with mute and video controls
- Proper error handling and display

### Recordings Display Page
- Grid layout of recorded sessions
- Metadata display (date, duration, status)
- Status badges with color coding
- Play and download buttons for each recording

## Cloudflare Integration for Egress Optimization

While this implementation provides the foundation for Cloudflare integration, additional configuration is needed to fully leverage Cloudflare's CDN capabilities:

1. Configure Cloudflare R2 as an origin for your Backblaze B2 bucket
2. Set up custom caching rules in Cloudflare Dashboard
3. Update the `recording_url` to point to Cloudflare's CDN endpoint
4. Configure Cloudflare Workers for additional processing if needed

## Security Considerations

1. **Environment Variables**: All API keys and credentials are stored in environment variables
2. **Authentication**: Recording endpoints require valid user authentication
3. **Authorization**: Users can only access recordings for mentorships they are part of
4. **Signed URLs**: Temporary signed URLs for secure access to recorded videos
5. **Data Validation**: Input validation on all API endpoints

## Cost Optimization Benefits

1. **Backblaze B2**: 1/4th the cost of other cloud storage providers
2. **S3 Compatibility**: Seamless integration without changing code
3. **Cloudflare CDN**: Reduced egress costs for global distribution
4. **Scalable Storage**: Pay only for what you use with high durability

## Implementation Status

- ✅ Video recording functionality
- ✅ Backblaze B2 integration
- ✅ Database schema updates
- ✅ API endpoints
- ✅ Frontend recording controls
- ✅ Recording playback interface
- ✅ Error handling
- ⏳ Cloudflare R2/CDN configuration (recommended for production)

## Testing

### Unit Tests
Add tests for recording service, storage service, and API endpoints.

### Integration Tests
Test the complete recording flow from start to finish.

### Load Testing
Validate the solution can handle concurrent recordings and storage of large video files.

## Deployment Considerations

1. Ensure environment variables are properly configured in production
2. Set up proper logging for monitoring recording operations
3. Configure alerts for failed recordings
4. Set up backup and retention policies for recorded videos
5. Consider implementing video transcoding for optimal playback

## Troubleshooting

### Common Issues

1. **Recording fails to start**: Verify Agora cloud recording is enabled in your Agora project
2. **Storage issues**: Check Backblaze B2 access keys and permissions
3. **Playback errors**: Verify CORS settings and URL formats
4. **Authentication errors**: Ensure users have proper access to mentorship sessions

### Monitoring

1. Monitor API endpoints for errors
2. Track recording success/failure rates
3. Monitor Backblaze B2 storage usage
4. Track egress costs to verify optimization

## Future Enhancements

1. **Video Transcoding**: Automatically transcode recordings to optimize file sizes
2. **Automatic Cleanup**: Implement retention policies for old recordings
3. **Enhanced Metadata**: Add more detailed analytics about recordings
4. **Cloudflare Workers**: Implement advanced processing for video optimization
5. **Live Streaming**: Extend solution to support RTMP live streaming
6. **Video Thumbnails**: Generate thumbnails for recordings
7. **Playback Analytics**: Track video engagement metrics
8. **Mobile Optimization**: Optimize video format for mobile playback