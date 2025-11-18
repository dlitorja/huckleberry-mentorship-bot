# Video Calling MVP Implementation Plan

## 🎯 MVP Scope
**Goal:** Get basic video calling working between instructors and students  
**Timeline:** 4-5 weeks  
**Excludes:** Recording functionality (Phase 2 feature)

---

## 📋 MVP Features

### ✅ **Included in MVP:**
- Real-time video/audio calling between instructor and student
- Agora SDK integration
- Token-based authentication
- Mentorship relationship validation
- Role-based permissions (instructor = host, student = audience)
- Basic call controls (mute, camera toggle, leave call)
- Call history tracking in database
- UI integration in dashboard

### ❌ **Excluded from MVP (Phase 2):**
- Recording functionality
- Cloudflare + Backblaze B2 integration
- Recording playback
- Advanced call settings
- Call quality metrics/analytics

---

## 🗓️ Week-by-Week Breakdown

### **Week 1: Backend Foundation** (5 days)

#### Day 1-2: Setup & Configuration
- [ ] **Day 1 Morning:** Set up Agora developer account
  - Create account at agora.io
  - Create new project
  - Get App ID and App Certificate
  - Add to environment variables
- [ ] **Day 1 Afternoon:** Install Agora SDK packages
  ```bash
  npm install agora-rtc-sdk-ng
  ```
- [ ] **Day 2:** Update environment configuration
  - Add to `huckleberry-web-portal/src/config/environment.ts`:
    ```typescript
    AGORA_APP_ID: getEnvVar('NEXT_PUBLIC_AGORA_APP_ID'),
    AGORA_APP_CERTIFICATE: getEnvVar('AGORA_APP_CERTIFICATE'),
    ```
  - Add to `.env.example`
  - Update `src/config/schema.ts` (bot side) if needed

#### Day 3-4: Token Generation API
- [ ] **Day 3:** Create Agora token utility
  - File: `huckleberry-web-portal/lib/agora/token.ts`
  - Function: `generateAgoraToken(channelName, userId, role)`
  - Use Agora's token generation library or implement RTC token generation
  - Handle token expiration (24 hours default)
- [ ] **Day 4:** Create token generation API endpoint
  - File: `huckleberry-web-portal/app/api/video-call/token/route.ts`
  - Endpoint: `POST /api/video-call/token`
  - Request body: `{ mentorshipId: string }`
  - Validate mentorship relationship
  - Check user role (instructor vs student)
  - Generate token with appropriate role (host for instructor, audience for student)
  - Return: `{ token: string, channelName: string, appId: string, userId: string }`

#### Day 5: Database Schema
- [ ] Create migration file
  - File: `huckleberry-mentorship-bot/migrations/add_video_calls_table.sql`
  - Table: `video_calls`
    ```sql
    CREATE TABLE video_calls (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        mentorship_id UUID REFERENCES mentorships(id) ON DELETE CASCADE,
        instructor_id UUID REFERENCES instructors(id),
        mentee_id UUID REFERENCES mentees(id),
        start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        end_time TIMESTAMP WITH TIME ZONE,
        duration_seconds INTEGER,
        status TEXT DEFAULT 'active', -- 'active', 'ended', 'failed'
        participants JSONB, -- Store participant info
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX idx_video_calls_mentorship ON video_calls(mentorship_id);
    CREATE INDEX idx_video_calls_start_time ON video_calls(start_time DESC);
    ```
- [ ] Run migration in Supabase
- [ ] Test database connection

---

### **Week 2: Backend APIs & Auth** (5 days)

#### Day 1-2: Call Management APIs
- [ ] **Day 1:** Create call start/end tracking API
  - File: `huckleberry-web-portal/app/api/video-call/start/route.ts`
  - Endpoint: `POST /api/video-call/start`
  - Creates `video_calls` record with status 'active'
  - Returns call ID
- [ ] **Day 2:** Create call end API
  - File: `huckleberry-web-portal/app/api/video-call/end/route.ts`
  - Endpoint: `POST /api/video-call/end`
  - Updates `video_calls` record with end_time and duration
  - Sets status to 'ended'

#### Day 3: Call History API
- [ ] Create call history endpoint
  - File: `huckleberry-web-portal/app/api/video-call/history/route.ts`
  - Endpoint: `GET /api/video-call/history?mentorshipId=xxx`
  - Returns list of past calls for a mentorship
  - Include pagination if needed
  - Filter by mentorship relationship

#### Day 4: Authentication & Authorization
- [ ] **Mentorship validation middleware**
  - File: `huckleberry-web-portal/lib/agora/validate-mentorship.ts`
  - Function: `validateMentorshipAccess(discordId, mentorshipId, role)`
  - Check if user is instructor or mentee for this mentorship
  - Return boolean + user info
- [ ] **Integrate validation into token endpoint**
  - Add validation before token generation
  - Return 403 if unauthorized

#### Day 5: Testing & Refinement
- [ ] Test all API endpoints with Postman/curl
- [ ] Test mentorship validation edge cases
- [ ] Fix any bugs
- [ ] Add error handling and logging

---

### **Week 3: Frontend Core Components** (5 days)

#### Day 1-2: Agora SDK Integration
- [ ] **Day 1:** Create VideoCall hook
  - File: `huckleberry-web-portal/hooks/useAgoraVideoCall.ts`
  - Initialize Agora client
  - Handle join/leave channel
  - Manage local/remote tracks
  - Handle connection state
- [ ] **Day 2:** Create basic VideoCall component
  - File: `huckleberry-web-portal/components/VideoCall.tsx`
  - Display local video
  - Display remote video(s)
  - Basic layout (side-by-side or grid)

#### Day 3: Call Controls
- [ ] Add control buttons to VideoCall component
  - Mute/unmute audio
  - Enable/disable camera
  - Leave call
- [ ] Add visual indicators (mic/camera on/off icons)
- [ ] Handle device permissions (request mic/camera access)

#### Day 4: Call Flow Integration
- [ ] Create "Start Video Call" button in dashboard
  - Instructor dashboard: Show for each mentorship
  - Student dashboard: Show if instructor is available
- [ ] Create call page/route
  - File: `huckleberry-web-portal/app/(dashboard)/video-call/[mentorshipId]/page.tsx`
  - Fetch token on page load
  - Initialize VideoCall component
  - Handle call start/end tracking

#### Day 5: UI Polish
- [ ] Style video call interface
- [ ] Add loading states
- [ ] Add error handling UI
- [ ] Responsive design (mobile-friendly)
- [ ] Dark mode support

---

### **Week 4: Integration & Testing** (5 days)

#### Day 1: Dashboard Integration
- [ ] Add "Video Call" section to instructor dashboard
  - Show active/available calls
  - Button to start new call
- [ ] Add "Video Call" section to student dashboard
  - Show if instructor is available
  - Join call button
- [ ] Add call history display
  - Show past calls in dashboard
  - Link to call history page

#### Day 2: Call History UI
- [ ] Create call history page
  - File: `huckleberry-web-portal/app/(dashboard)/video-call/history/page.tsx`
  - Display list of past calls
  - Show date, duration, participants
  - Filter by mentorship

#### Day 3: Error Handling & Edge Cases
- [ ] Handle network disconnections
- [ ] Handle browser permission denials
- [ ] Handle invalid tokens
- [ ] Handle mentorship not found
- [ ] Add user-friendly error messages

#### Day 4: Cross-Browser Testing
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if needed)
- [ ] Test in Edge
- [ ] Fix any browser-specific issues

#### Day 5: End-to-End Testing
- [ ] Test full call flow (instructor starts, student joins)
- [ ] Test call controls (mute, camera toggle)
- [ ] Test call end and history tracking
- [ ] Test authorization (unauthorized users can't join)
- [ ] Performance testing (multiple concurrent calls)
- [ ] Bug fixes

---

### **Week 5: Polish & Deployment** (5 days)

#### Day 1-2: Code Review & Refinement
- [ ] Code cleanup
- [ ] Add TypeScript types
- [ ] Add JSDoc comments
- [ ] Optimize performance
- [ ] Remove console.logs

#### Day 3: Documentation
- [ ] Update README with video calling setup
- [ ] Document environment variables
- [ ] Document API endpoints
- [ ] Add inline code comments

#### Day 4: Production Preparation
- [ ] Set up Agora production credentials
- [ ] Test in staging environment
- [ ] Verify all environment variables
- [ ] Set up error monitoring (if applicable)

#### Day 5: Deployment & Verification
- [ ] Deploy to production
- [ ] Smoke test in production
- [ ] Monitor for errors
- [ ] Gather initial user feedback

---

## 🏗️ Technical Implementation Details

### Environment Variables (MVP)
```env
# Agora Configuration
NEXT_PUBLIC_AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_app_certificate
```

### API Endpoints (MVP)

#### 1. Generate Token
```
POST /api/video-call/token
Body: { mentorshipId: string }
Response: {
  token: string,
  channelName: string,
  appId: string,
  userId: string,
  role: 'host' | 'audience'
}
```

#### 2. Start Call
```
POST /api/video-call/start
Body: { mentorshipId: string }
Response: {
  callId: string,
  startTime: string
}
```

#### 3. End Call
```
POST /api/video-call/end
Body: { callId: string }
Response: { success: boolean }
```

#### 4. Get Call History
```
GET /api/video-call/history?mentorshipId=xxx
Response: {
  calls: Array<{
    id: string,
    startTime: string,
    endTime: string | null,
    durationSeconds: number | null,
    status: string
  }>
}
```

### Component Structure
```
components/
  VideoCall.tsx          # Main video call component
  VideoCallControls.tsx  # Mute, camera, leave buttons
  VideoCallHistory.tsx   # Display past calls

hooks/
  useAgoraVideoCall.ts   # Agora SDK integration hook

lib/
  agora/
    token.ts             # Token generation utility
    validate-mentorship.ts # Authorization logic

app/
  api/
    video-call/
      token/
        route.ts         # Token generation endpoint
      start/
        route.ts         # Start call tracking
      end/
        route.ts         # End call tracking
      history/
        route.ts         # Call history endpoint
  (dashboard)/
    video-call/
      [mentorshipId]/
        page.tsx         # Call page
      history/
        page.tsx         # History page
```

---

## ✅ Success Criteria (MVP)

- [ ] Instructor can start a video call for a mentorship
- [ ] Student can join the same call using mentorship ID
- [ ] Both users can see and hear each other
- [ ] Mute/unmute and camera toggle work
- [ ] Call history is tracked in database
- [ ] Only authorized users (instructor/student of that mentorship) can join
- [ ] Calls work in Chrome and Firefox
- [ ] Basic error handling works
- [ ] UI is functional and responsive

---

## 🚨 Known Limitations (MVP)

1. **No Recording:** Calls are not recorded (Phase 2 feature)
2. **No Call Quality Metrics:** No analytics on call quality
3. **No Advanced Settings:** No custom video/audio settings
4. **No Screen Sharing:** Not included in MVP
5. **No Chat:** No text chat during calls
6. **No Waiting Room:** Users join directly (no approval flow)

---

## 📝 Next Steps After MVP

Once MVP is working and tested:
1. Gather user feedback
2. Identify pain points
3. Plan Phase 2 (Recording functionality)
4. Consider additional features based on usage

---

## 🛠️ Development Tips

1. **Start with token generation** - Get this working first, everything depends on it
2. **Test locally with two browser windows** - Simulate instructor and student
3. **Use Agora's test console** - Test tokens before building UI
4. **Handle errors gracefully** - Network issues, permissions, etc.
5. **Log everything** - Helps debug issues in production

---

**Estimated Total Time:** 4-5 weeks (20-25 working days)  
**Priority:** High - Core feature for mentorship platform  
**Dependencies:** Agora account, Supabase database access

