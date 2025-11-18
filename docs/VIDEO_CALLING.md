# Video Calling Feature Documentation

## 📊 Current Status: ~90% Complete

The video calling feature is largely implemented and functional. Most core functionality is complete - the main gaps are call history UI and additional testing.

### ✅ Completed Features
- Backend APIs (token generation, start/end call, history)
- Database schema and migration
- Frontend components (VideoCall component, controls)
- Dashboard integration (call buttons)
- Authentication and authorization
- Basic error handling

### ⚠️ Remaining Work
- Call history UI page (API exists, UI needed)
- Cross-browser testing
- End-to-end testing
- Performance testing

---

## 🚀 Quick Start

### Step 1: Run Database Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `database/add_video_calls.sql`
4. Click **Run**

This creates the `video_calls` table and all necessary indexes.

### Step 2: Set Agora Credentials

Add to your `.env` file:
```env
NEXT_PUBLIC_AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate
```

**Note:** You can test the start/end/history APIs without Agora credentials. Only the token API requires them.

### Step 3: Test the APIs

After running the migration:
1. **Test Start Call** - Creates database record
2. **Test End Call** - Updates database record
3. **Test History** - Reads from database
4. **Test Token** - Requires Agora credentials

---

## 🏗️ Architecture

### Backend APIs

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

### Frontend Components

- `components/VideoCall.tsx` - Main video call component
- `hooks/useAgoraVideoCall.ts` - Agora SDK integration hook
- `app/(dashboard)/video-call/[mentorshipId]/page.tsx` - Call page

### Database Schema

The `video_calls` table tracks:
- Call ID, mentorship ID, instructor/mentee IDs
- Start/end times, duration
- Status (active, ended, failed)
- Participants information

---

## 🔧 Configuration

### Environment Variables

```env
NEXT_PUBLIC_AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate
```

To get Agora credentials:
1. Sign up at [https://www.agora.io/](https://www.agora.io/)
2. Create a new project
3. Copy your App ID and App Certificate

---

## 🧪 Testing

### Manual Testing

See `huckleberry-web-portal/docs/VIDEO_CALL_TESTING.md` for detailed testing instructions.

### Test Page

Access the test page at: `http://localhost:3000/video-call/test`

This page allows you to:
- Test token generation
- Test call start/end
- Test call history
- Verify API responses

### Troubleshooting

**404 Errors on Test Page:**
- Clear browser cache (Ctrl+Shift+R)
- Restart dev server: `rm -rf .next && npm run dev`
- Check that route exists: `app/(dashboard)/video-call/test/page.tsx`

**500 Errors:**
- Verify database migration has been run
- Check Supabase connection
- Review server logs

**503 Errors (Token API):**
- Verify Agora credentials are set
- Check environment variables

---

## 📋 Implementation Details

### Authentication & Authorization

- Mentorship validation middleware ensures only authorized users (instructor/student of that mentorship) can join
- Role-based permissions: instructor = host, student = audience
- Token generation validates mentorship relationship before issuing tokens

### Call Flow

1. User clicks "Start Video Call" button in dashboard
2. Page loads and fetches Agora token
3. VideoCall component initializes with token
4. User joins Agora channel
5. Call start API creates database record
6. When call ends, end API updates record with duration

### Error Handling

- Invalid mentorship ID → 403 Forbidden
- Missing Agora credentials → 503 Service Unavailable
- Database errors → 500 with error details
- Network disconnections → Handled gracefully in UI

---

## 🎯 Success Criteria

- ✅ Instructor can start a video call for a mentorship
- ✅ Student can join the same call using mentorship ID
- ✅ Both users can see and hear each other
- ✅ Mute/unmute and camera toggle work
- ✅ Call history is tracked in database
- ✅ Only authorized users can join
- ⚠️ Calls work in Chrome and Firefox (needs testing)
- ✅ Basic error handling works
- ✅ UI is functional and responsive

**Overall: 7/9 criteria met, 1 needs verification, 1 needs testing**

---

## 📝 Next Steps

### Priority 1: Call History UI
- Create `app/(dashboard)/video-call/history/page.tsx`
- Display list of past calls
- Show date, duration, participants
- Link from dashboards

### Priority 2: Testing
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- End-to-end testing (full call flow)
- Performance testing (multiple concurrent calls)

### Priority 3: Polish
- Code review & cleanup
- Documentation updates
- Production deployment preparation

---

## 🚨 Known Limitations

1. **No Recording:** Calls are not recorded (Phase 2 feature)
2. **No Call Quality Metrics:** No analytics on call quality
3. **No Advanced Settings:** No custom video/audio settings
4. **No Screen Sharing:** Not included in MVP
5. **No Chat:** No text chat during calls
6. **No Waiting Room:** Users join directly (no approval flow)

---

## 📚 Related Documentation

- [Configuration Guide](./CONFIGURATION.md) - Environment variables
- [Web Portal Testing Guide](../huckleberry-web-portal/docs/VIDEO_CALL_TESTING.md) - Detailed testing instructions
- [API Testing Guide](../huckleberry-web-portal/docs/API_TESTING.md) - API endpoint testing

---

## 💡 Future Enhancements (Phase 2)

- Recording functionality
- Cloudflare + Backblaze B2 integration for recording storage
- Recording playback
- Advanced call settings
- Call quality metrics/analytics
- Screen sharing
- Text chat during calls

