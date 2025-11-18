# Testing Video Recording Functionality

## Prerequisites ✅

- ✅ Database migration completed
- ✅ Backblaze B2 credentials configured
- ✅ Agora credentials configured and verified
- ✅ Cloud Recording enabled in Agora Console

## Test Plan

### Test 1: Start a Video Call

1. **Navigate to a mentorship** in your dashboard
2. **Click "Start Video Call"** button
3. **Verify**:
   - Video call page loads
   - You can see your local video
   - No errors in browser console
   - Call is tracked in database (check `video_calls` table)

### Test 2: Start Recording

1. **While in the video call**, look for the **Record button** (usually has a red dot/indicator)
2. **Click "Record"** or "Start Recording"
3. **Verify**:
   - Button shows "Recording..." or loading state
   - Recording indicator appears (red "REC" badge)
   - No errors in browser console
   - Check server logs for: `[Video Recordings]` messages
   - Database shows `recording_status = 'recording'` for the call

**Expected Server Logs:**
```
[Video Recordings] Starting cloud recording...
Recording started successfully
```

**Check Database:**
```sql
SELECT id, recording_status, recording_metadata 
FROM video_calls 
WHERE status = 'active' 
ORDER BY start_time DESC 
LIMIT 1;
```

Should show:
- `recording_status = 'recording'`
- `recording_metadata` contains `agoraResourceId`

### Test 3: Stop Recording

1. **Click "Stop Recording"** button
2. **Verify**:
   - Recording indicator disappears
   - Button returns to normal state
   - No errors in browser console
   - Check server logs for successful stop
   - Database shows `recording_status = 'recorded'`

**Expected Server Logs:**
```
[Video Recordings] Stopping cloud recording...
Recording stopped successfully
```

**Check Database:**
```sql
SELECT id, recording_status, recording_url, recording_key, recording_metadata 
FROM video_calls 
WHERE recording_status = 'recorded' 
ORDER BY start_time DESC 
LIMIT 1;
```

Should show:
- `recording_status = 'recorded'`
- `recording_url` or `recording_key` populated
- `recording_metadata` contains stop information

### Test 4: Verify File in Backblaze B2

1. **Go to Backblaze B2 Console**: https://secure.backblaze.com/b2_buckets.htm
2. **Navigate to your bucket**
3. **Check for files** in path: `recordings/{callId}/`
4. **Verify**:
   - Video file exists (`.mp4` file)
   - File size is reasonable (not 0 bytes)
   - File was created recently

### Test 5: View Recordings Page

1. **Navigate to**: `/video-call/{mentorshipId}/recordings`
2. **Verify**:
   - Recordings page loads
   - Your test recording appears in the list
   - Shows correct date/time
   - Shows recording status badge
   - "Watch" and "Download" buttons are visible

### Test 6: Playback Test

1. **Click "Watch"** button on a recording
2. **Verify**:
   - Video opens in new tab/window
   - Video player loads
   - Video plays (or at least loads without errors)
   - Signed URL is generated correctly

## Troubleshooting

### Issue: Recording Button Doesn't Appear

**Check:**
- Video call is active
- User has permission to record (instructor role)
- Browser console for errors

**Solution:**
- Verify call is fully initialized
- Check user role/permissions

### Issue: "Failed to start recording"

**Check Server Logs:**
- Look for Agora API errors
- Check for "401 Unauthorized" (certificate issue)
- Check for "404 Not Found" (App ID issue)
- Check for "Failed to acquire recording resource"

**Common Causes:**
- Cloud Recording not enabled in Agora Console
- Invalid App Certificate
- Backblaze B2 credentials missing
- Network/firewall blocking Agora API

**Solution:**
- Verify Cloud Recording is enabled in Agora Console
- Double-check all environment variables
- Check server logs for specific error messages

### Issue: Recording Starts but Never Stops

**Check:**
- Server logs for stop recording API call
- Database for `recording_status` value
- Browser console for errors when clicking stop

**Solution:**
- Verify stop recording API is being called
- Check that `resourceId` is stored in metadata
- Verify recording service `stopRecording` method

### Issue: No File in Backblaze B2

**Check:**
- Recording actually completed (status = 'recorded')
- Backblaze B2 credentials are correct
- Bucket name is correct
- File path matches what's in database

**Solution:**
- Verify Backblaze B2 configuration
- Check Agora is configured to use Backblaze B2 storage
- Wait a few minutes - file upload may be delayed
- Check Agora Console for recording status

### Issue: Video Won't Play

**Check:**
- File exists in Backblaze B2
- File size is not 0 bytes
- Signed URL is generated correctly
- CORS settings on Backblaze B2 bucket

**Solution:**
- Verify file was uploaded successfully
- Check Backblaze B2 bucket CORS settings
- Try downloading the file directly from Backblaze B2
- Check browser console for CORS errors

## Success Criteria

✅ Recording starts successfully  
✅ Recording stops successfully  
✅ File appears in Backblaze B2  
✅ Recording appears on recordings page  
✅ Video can be played/downloaded  

## Next Steps After Testing

Once all tests pass:
1. ✅ Remove test API route (`app/api/test-agora-config/route.ts`)
2. ✅ Test with multiple concurrent recordings
3. ✅ Test error scenarios (network failures, etc.)
4. ✅ Monitor production for any issues
5. ✅ Set up monitoring/alerts for failed recordings

## Cleanup

After successful testing, you can remove:
- `app/api/test-agora-config/route.ts` (test endpoint)
- `docs/VERIFY_AGORA_CERTIFICATE.md` (if no longer needed)
- `docs/AGORA_CLOUD_RECORDING_SETUP.md` (if no longer needed)

Keep for reference:
- `docs/TESTING_RECORDING.md` (this file)
- `docs/VIDEO_CALLING.md` (main documentation)

