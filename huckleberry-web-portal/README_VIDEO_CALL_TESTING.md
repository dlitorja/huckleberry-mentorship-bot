# Video Call API Testing - Quick Start

## Issue: 404 Errors on Test Page

If you're seeing 404 errors for Next.js static chunks when accessing `/video-call/test`, try these steps:

### Solution 1: Restart Dev Server

1. **Stop the current dev server** (Ctrl+C in the terminal running `npm run dev`)
2. **Clear the build cache:**
   ```bash
   rm -rf .next
   ```
3. **Restart the dev server:**
   ```bash
   npm run dev
   ```
4. **Wait for compilation to complete** (you'll see "Ready" in the terminal)
5. **Refresh your browser** at `http://localhost:3000/video-call/test`

### Solution 2: Check Port Conflicts

If port 3000 is already in use:
```bash
# Check what's using port 3000
lsof -i :3000

# Or use a different port
npm run dev -- -p 3001
```

### Solution 3: Verify Route Structure

The test page should be at:
- **File:** `app/(dashboard)/video-call/test/page.tsx`
- **URL:** `http://localhost:3000/video-call/test`

Make sure the file exists and the dev server has compiled it.

### Solution 4: Check Browser Console

Open browser DevTools (F12) and check:
- **Console tab:** Look for JavaScript errors
- **Network tab:** Check if requests are being made correctly
- **Application tab:** Clear cache and cookies if needed

## Testing the APIs

Once the page loads:

1. **Get a Mentorship ID:**
   - Go to your dashboard
   - Or query Supabase: `SELECT id FROM mentorships LIMIT 1;`

2. **Enter the Mentorship ID** in the test page

3. **Test each endpoint:**
   - **Test Token API** - Generates Agora token
   - **Test Start Call** - Creates call record
   - **Test End Call** - Ends the call
   - **Test History** - Shows call history

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

## Still Having Issues?

1. Check server logs in the terminal running `npm run dev`
2. Verify all environment variables are set
3. Ensure database migration has been run
4. Try accessing other dashboard pages to confirm authentication works

