# Video Call API Testing Guide

## Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Get a valid mentorship ID:**
   - Log into the web portal
   - Go to your dashboard
   - Find a mentorship ID from the URL or database
   - Or query Supabase: `SELECT id FROM mentorships LIMIT 1;`

3. **Ensure you're logged in:**
   - The APIs require authentication via NextAuth session
   - Make sure you have a valid session cookie

## Manual Testing with Browser DevTools

### 1. Get Your Session Cookie

1. Open the web portal in your browser
2. Open DevTools (F12)
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Navigate to **Cookies** > `http://localhost:3000`
5. Find the cookie named `next-auth.session-token`
6. Copy its value

### 2. Test Token Generation API

```bash
curl -X POST http://localhost:3000/api/video-call/token \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"mentorshipId": "YOUR_MENTORSHIP_ID_HERE"}'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "channelName": "mentorship-uuid",
  "appId": "your-agora-app-id",
  "userId": "discord-user-id",
  "role": "host" // or "audience"
}
```

### 3. Test Start Call API

```bash
curl -X POST http://localhost:3000/api/video-call/start \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"mentorshipId": "YOUR_MENTORSHIP_ID_HERE"}'
```

**Expected Response:**
```json
{
  "callId": "video-call-uuid",
  "startTime": "2025-01-18T10:30:00.000Z",
  "mentorshipId": "mentorship-uuid"
}
```

### 4. Test End Call API

```bash
curl -X POST http://localhost:3000/api/video-call/end \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"callId": "VIDEO_CALL_ID_FROM_START_RESPONSE"}'
```

**Expected Response:**
```json
{
  "success": true,
  "callId": "video-call-uuid",
  "durationSeconds": 120,
  "endTime": "2025-01-18T10:32:00.000Z"
}
```

### 5. Test Call History API

```bash
curl -X GET "http://localhost:3000/api/video-call/history?mentorshipId=YOUR_MENTORSHIP_ID_HERE" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "calls": [
    {
      "id": "video-call-uuid",
      "start_time": "2025-01-18T10:30:00.000Z",
      "end_time": "2025-01-18T10:32:00.000Z",
      "duration_seconds": 120,
      "status": "ended",
      "participants": {
        "instructor": { "discordId": "...", "joinedAt": "..." },
        "mentee": { "discordId": "...", "joinedAt": "..." }
      }
    }
  ]
}
```

## Testing with Postman

1. **Import Collection:**
   - Create a new collection in Postman
   - Add the 4 API endpoints above

2. **Set Environment Variables:**
   - `base_url`: `http://localhost:3000`
   - `session_token`: Your NextAuth session token
   - `mentorship_id`: A valid mentorship UUID

3. **Add Authentication:**
   - For each request, add a Cookie header:
     - Name: `Cookie`
     - Value: `next-auth.session-token={{session_token}}`

## Testing Error Cases

### 1. Unauthorized (No Session)
```bash
curl -X POST http://localhost:3000/api/video-call/token \
  -H "Content-Type: application/json" \
  -d '{"mentorshipId": "test"}'
```
**Expected:** `401 Unauthorized`

### 2. Invalid Mentorship ID
```bash
curl -X POST http://localhost:3000/api/video-call/token \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"mentorshipId": "invalid-uuid"}'
```
**Expected:** `403 Forbidden` (if mentorship doesn't exist or user doesn't have access)

### 3. Missing Required Fields
```bash
curl -X POST http://localhost:3000/api/video-call/token \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{}'
```
**Expected:** `400 Bad Request` with error message

### 4. Agora Not Configured
If `NEXT_PUBLIC_AGORA_APP_ID` or `AGORA_APP_CERTIFICATE` is missing:
**Expected:** `503 Service Unavailable` with "Video calling is not configured"

## Database Verification

After testing, verify the data in Supabase:

```sql
-- Check video calls table
SELECT * FROM video_calls 
WHERE mentorship_id = 'YOUR_MENTORSHIP_ID' 
ORDER BY start_time DESC 
LIMIT 10;

-- Check call count
SELECT COUNT(*) as total_calls, 
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_calls,
       COUNT(CASE WHEN status = 'ended' THEN 1 END) as ended_calls
FROM video_calls
WHERE mentorship_id = 'YOUR_MENTORSHIP_ID';
```

## Troubleshooting

### Issue: 401 Unauthorized
- **Solution:** Make sure you're logged in and have a valid session cookie
- Check that the cookie hasn't expired
- Try logging out and back in

### Issue: 403 Forbidden
- **Solution:** Verify that:
  - The mentorship ID exists
  - You (the logged-in user) are either the instructor or mentee for this mentorship
  - The mentorship status is 'active'

### Issue: 503 Service Unavailable
- **Solution:** Check that Agora environment variables are set:
  - `NEXT_PUBLIC_AGORA_APP_ID`
  - `AGORA_APP_CERTIFICATE`

### Issue: 500 Internal Server Error
- **Solution:** Check server logs for detailed error messages
- Verify database connection
- Ensure the `video_calls` table exists (run migration)

## Next Steps

Once APIs are tested and working:
1. Move to Week 3: Frontend Components
2. Integrate Agora SDK in React
3. Create VideoCall component
4. Connect frontend to these APIs

