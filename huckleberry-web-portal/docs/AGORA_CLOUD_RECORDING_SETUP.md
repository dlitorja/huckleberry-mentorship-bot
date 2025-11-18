# Agora Cloud Recording Setup Guide

## Step 1: Verify Agora Credentials

First, make sure your Agora credentials are in your `.env.local` file:

```env
NEXT_PUBLIC_AGORA_APP_ID=your_app_id_here
AGORA_APP_CERTIFICATE=your_certificate_here
```

**Where to find these:**
1. Go to [Agora Console](https://console.agora.io/)
2. Sign in to your account
3. Select your project (or create a new one)
4. Go to **Project Management** → **Config** tab
5. You'll see:
   - **App ID** → This is your `NEXT_PUBLIC_AGORA_APP_ID`
   - **App Certificate** → Click "Show" to reveal it → This is your `AGORA_APP_CERTIFICATE`

---

## Step 2: Enable Cloud Recording

### Option A: Enable via Agora Console (Recommended)

1. **Go to Agora Console**: https://console.agora.io/
2. **Select your project**
3. **Navigate to**: **Project Management** → **Features** tab
4. **Find "Cloud Recording"** section
5. **Enable Cloud Recording**:
   - Toggle it ON if it's disabled
   - Make sure it's activated for your project

### Option B: Verify via API (If Console doesn't show option)

Cloud Recording is typically enabled by default for paid accounts. If you're on a free tier, you may need to:
- Upgrade to a paid plan, OR
- Contact Agora support to enable it

---

## Step 3: Verify Storage Configuration

Cloud Recording needs to know where to store files. Our implementation uses **Backblaze B2** with S3-compatible API.

**Make sure you have:**
- ✅ Backblaze B2 bucket created
- ✅ Application Key with read/write permissions
- ✅ Environment variables configured (you've already done this!)

The recording service will automatically configure Agora to use Backblaze B2 when starting a recording.

---

## Step 4: Test the Configuration

### Quick Test Script

You can test if cloud recording is properly configured by checking:

1. **Check environment variables are loaded:**
   ```bash
   # In your terminal, verify the variables are set
   echo $NEXT_PUBLIC_AGORA_APP_ID
   echo $AGORA_APP_CERTIFICATE
   ```

2. **Test in your app:**
   - Start a video call
   - Click the record button
   - Check the browser console for any errors
   - Check server logs for recording API responses

### Common Issues

**Issue: "Failed to acquire recording resource"**
- **Cause**: Cloud Recording not enabled for your project
- **Solution**: Enable it in Agora Console (Step 2)

**Issue: "Failed to start recording: 404"**
- **Cause**: Invalid App ID or Certificate
- **Solution**: Double-check your credentials in `.env.local`

**Issue: "Storage configuration not found"**
- **Cause**: Backblaze B2 credentials missing
- **Solution**: Verify all Backblaze environment variables are set

**Issue: "Unauthorized" or "403"**
- **Cause**: Invalid App Certificate
- **Solution**: Regenerate App Certificate in Agora Console

---

## Step 5: Verify Recording Permissions

Make sure your Agora App Certificate has the necessary permissions:

1. Go to **Project Management** → **Config**
2. Check that your App Certificate is active
3. If needed, regenerate it and update your `.env.local`

---

## Step 6: Test Recording Flow

Once everything is configured:

1. **Start a video call** between two users
2. **Click "Record"** button
3. **Wait a few seconds** - recording should start
4. **Check database** - `video_calls` table should show `recording_status = 'recording'`
5. **Click "Stop Recording"**
6. **Check database** - status should change to `recording_status = 'recorded'`
7. **Check Backblaze B2 bucket** - video file should appear
8. **Visit recordings page** - recording should be listed

---

## Troubleshooting

### Check Server Logs

When you start a recording, check your server logs for:
- `[Video Recordings]` - Recording API calls
- `Error starting cloud recording` - Agora API errors
- `Failed to start cloud recording` - Recording service errors

### Check Browser Console

In the browser console, look for:
- Recording button click events
- API response errors
- Network request failures

### Verify API Endpoints

Test the recording API directly:

```bash
# Test start recording (replace with actual values)
curl -X POST http://localhost:3000/api/video-call/recordings \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "your-call-id",
    "recordingStatus": "recording",
    "channelName": "test-channel",
    "uid": "test-uid"
  }'
```

---

## Next Steps

After verifying Agora cloud recording is enabled:

1. ✅ Test recording start/stop functionality
2. ✅ Verify files are being stored in Backblaze B2
3. ✅ Test video playback from recordings page
4. ✅ Monitor for any errors in production

---

## Additional Resources

- [Agora Cloud Recording Documentation](https://docs.agora.io/en/cloud-recording/overview/product-overview)
- [Agora Console](https://console.agora.io/)
- [Backblaze B2 Documentation](https://www.backblaze.com/b2/docs/)

