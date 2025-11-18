# Video Call Testing Guide

## Quick Start

### Prerequisites

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

## Test Page

Access the test page at: `http://localhost:3000/video-call/test`

This page allows you to:
- Test token generation
- Test call start/end
- Test call history
- Verify API responses

## Troubleshooting 404 Errors

If you're seeing 404 errors for Next.js static chunks:

### Solution 1: Hard Refresh Browser
- **Chrome/Edge:** Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- **Firefox:** Press `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)
- Or open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

### Solution 2: Clear Browser Cache
1. Open DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Clear storage** or **Clear site data**
4. Check all boxes and click **Clear site data**
5. Refresh the page

### Solution 3: Restart Dev Server
1. **Stop the dev server:** Press `Ctrl + C` in the terminal running `npm run dev`
2. **Clear build cache:**
   ```bash
   rm -rf .next
   ```
3. **Restart dev server:**
   ```bash
   npm run dev
   ```
4. **Wait for compilation** (look for "Ready" message)
5. **Hard refresh browser**

### Solution 4: Check Port Conflicts
If port 3000 is in use:
```bash
# Check what's using port 3000
lsof -i :3000

# Or use a different port
npm run dev -- -p 3001
# Then access: http://localhost:3001/video-call/test
```

## Manual API Testing

### Get Your Session Cookie

1. Open the web portal in your browser
2. Open DevTools (F12)
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Navigate to **Cookies** > `http://localhost:3000`
5. Find the cookie named `next-auth.session-token`
6. Copy its value

### Test Token Generation API

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
  "role": "host"
}
```

### Test Start Call API

```bash
curl -X POST http://localhost:3000/api/video-call/start \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"mentorshipId": "YOUR_MENTORSHIP_ID_HERE"}'
```

### Test End Call API

```bash
curl -X POST http://localhost:3000/api/video-call/end \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE" \
  -d '{"callId": "VIDEO_CALL_ID_FROM_START_RESPONSE"}'
```

### Test Call History API

```bash
curl -X GET "http://localhost:3000/api/video-call/history?mentorshipId=YOUR_MENTORSHIP_ID_HERE" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN_HERE"
```

## Common Errors

### 401 Unauthorized
- **Cause:** Not logged in
- **Fix:** Log in first at `/login`

### 403 Forbidden
- **Cause:** User doesn't have access to the mentorship
- **Fix:** Use a mentorship ID where you're the instructor or mentee

### 503 Service Unavailable
- **Cause:** Agora credentials not configured
- **Fix:** Add to `.env`:
  ```
  NEXT_PUBLIC_AGORA_APP_ID=your_app_id
  AGORA_APP_CERTIFICATE=your_certificate
  ```

### 500 Internal Server Error
- **Cause:** Database table doesn't exist
- **Fix:** Run migration `database/add_video_calls.sql` in Supabase

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

## Still Having Issues?

1. Check server logs in the terminal running `npm run dev`
2. Verify all environment variables are set
3. Ensure database migration has been run
4. Try accessing other dashboard pages to confirm authentication works

