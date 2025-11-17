# Video Calling Integration Plan

## 🎯 Overview
This document outlines the implementation plan for adding video calling functionality to the Huckleberry Mentorship Bot web portal. The solution will use Agora for video calling with Cloudflare + Backblaze B2 for cost-effective egress and recording.

## 🧱 Architecture Components

### 1. Agora Integration
- [ ] Agora SDK setup in web portal
- [ ] Channel management (mentorship ID as channel name)
- [ ] Real-time video/audio streaming
- [ ] User role assignment (instructor/student)

### 2. Backend Services
- [ ] Agora token generation API
- [ ] Authentication verification with Supabase
- [ ] Video call session tracking
- [ ] Recording management

### 3. Database Schema
- [ ] Video call history table
- [ ] Video call settings configuration
- [ ] Recording metadata storage

### 4. Cloudflare + Backblaze Integration
- [ ] Storage proxy setup
- [ ] CDN configuration
- [ ] Egress optimization

## 📋 Implementation Steps

### Phase 1: Backend Infrastructure
- [ ] Set up Agora developer account and credentials
- [ ] Create Agora token generation utility
- [ ] Implement authentication middleware for video calls
- [ ] Add database migration for video call tables
- [ ] Create API endpoints for video call management
- [ ] Set up recording storage configuration

### Phase 2: Frontend Components
- [ ] Create VideoCall component with Agora SDK integration
- [ ] Implement video call controls (mute, camera toggle, etc.)
- [ ] Add video call UI to mentorship dashboard
- [ ] Implement recording controls
- [ ] Create video call history view

### Phase 3: Authentication & Authorization
- [ ] Verify instructor/mentee relationship before allowing call access
- [ ] Ensure both users join same channel (mentorship ID)
- [ ] Implement role-based permissions (host vs audience)
- [ ] Add call access validation

### Phase 4: Recording & Storage
- [ ] Configure Agora cloud recording
- [ ] Set up Cloudflare proxy for Backblaze B2
- [ ] Implement recording storage and retrieval
- [ ] Add recording management in UI

### Phase 5: Testing & Deployment
- [ ] Test video call functionality between instructor and mentee
- [ ] Verify correct call joining based on mentorship ID
- [ ] Test recording functionality and storage
- [ ] Performance testing with multiple concurrent calls
- [ ] Security testing of authentication

## 🏗️ Technical Implementation

### Environment Variables Required
- [ ] `AGORA_APP_ID` - Agora application ID
- [ ] `AGORA_APP_CERTIFICATE` - Agora app certificate
- [ ] `AGORA_RESTFUL_KEY` - Agora REST API key
- [ ] `BACKBLAZE_B2_AUTH` - Base64 encoded B2 authentication
- [ ] `BACKBLAZE_B2_BUCKET_NAME` - B2 bucket name

### Database Migration
```sql
-- Video call history
CREATE TABLE video_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mentorship_id UUID REFERENCES mentorships(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    participants JSONB, -- Store session participants
    recording_url TEXT, -- URL for recorded session
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video call settings per mentorship
CREATE TABLE video_call_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mentorship_id UUID REFERENCES mentorships(id) ON DELETE CASCADE,
    recording_enabled BOOLEAN DEFAULT false,
    automatic_recording BOOLEAN DEFAULT false,
    max_duration_minutes INTEGER DEFAULT 120,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_video_calls_mentorship ON video_calls(mentorship_id);
CREATE INDEX idx_video_calls_start_time ON video_calls(start_time DESC);
```

### API Endpoints
- [ ] `POST /api/video-call/agora/token` - Generate Agora token for user
- [ ] `POST /api/video-call/agora/record` - Start/stop recording
- [ ] `GET /api/video-call/history` - Get call history for mentorship
- [ ] `GET /api/video-call/settings` - Get video call settings
- [ ] `PUT /api/video-call/settings` - Update video call settings

### React Component Integration
- [ ] Create reusable VideoCall component
- [ ] Integrate into instructor dashboard
- [ ] Integrate into student dashboard
- [ ] Add video call history section
- [ ] Add recording playback functionality

## 🔐 Authentication Flow
- [ ] Verify user belongs to mentorship before generating token
- [ ] Assign correct roles (host for instructor, audience for student)
- [ ] Ensure both users join same channel (mentorship ID)
- [ ] Validate session permissions at token generation time

## 🧪 Testing Requirements
- [ ] Instructor and mentee join same call when using same mentorship ID
- [ ] Call access restricted to authorized users only
- [ ] Video call quality and performance testing
- [ ] Recording functionality validation
- [ ] Security testing of authentication
- [ ] Concurrent call handling

## 🚀 Deployment Checklist
- [ ] Environment variables configured in production
- [ ] Database migrations applied
- [ ] Agora account properly configured
- [ ] Cloudflare + Backblaze integration active
- [ ] Error handling and logging implemented
- [ ] Monitoring and observability set up

## 📊 Success Metrics
- [ ] Users successfully join same call for same mentorship
- [ ] Video call quality meets standards (low latency, good resolution)
- [ ] Recording functionality works reliably
- [ ] Egress costs reduced via Cloudflare + Backblaze setup
- [ ] Authentication prevents unauthorized access
- [ ] Call duration and performance metrics satisfactory

## 🛡️ Security Considerations
- [ ] Validate mentorship relationship before allowing access
- [ ] Secure token generation with proper expiration
- [ ] Role-based access controls for call functionality
- [ ] Secure recording storage with proper access controls
- [ ] Data privacy for recorded sessions

## 📅 Timeline
- **Phase 1 (Backend)**: 1-2 weeks
- **Phase 2 (Frontend)**: 2-3 weeks  
- **Phase 3 (Auth)**: 0.5-1 week
- **Phase 4 (Recording)**: 1-2 weeks
- **Phase 5 (Testing)**: 1 week

## 💰 Cost Optimization
- [ ] Verify Cloudflare + Backblaze B2 integration reduces egress costs
- [ ] Monitor Agora usage and optimize based on actual usage
- [ ] Implement recording cleanup for old sessions
- [ ] Set up usage alerts for cost monitoring

## 🧩 Integration Points
- [ ] Works with existing mentorship relationship in Supabase
- [ ] Integrates with NextAuth authentication
- [ ] Uses same user roles (student/instructor/admin) as rest of app
- [ ] Connects to existing mentorship dashboard UI