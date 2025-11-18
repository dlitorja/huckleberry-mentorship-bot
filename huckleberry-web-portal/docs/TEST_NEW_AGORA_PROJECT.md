# Testing New Agora Project

## Steps to Verify New Project

### Step 1: Verify Credentials Are Loaded

1. **Restart your dev server** (important after updating .env.local):
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Test credentials endpoint:**
   ```
   http://localhost:3000/api/test-agora-config
   ```

3. **Check response:**
   - Should show `configured: true`
   - App ID should be 32 characters (new one)
   - Certificate should be 32 characters (new one)
   - Preview should match your new credentials

### Step 2: Verify in Agora Console

1. **Go to your new project** in Agora Console
2. **Check Project Management → Features:**
   - Verify Cloud Recording is available
   - Enable it if needed
   - New projects often have it enabled by default

3. **Verify credentials match:**
   - App ID in console matches what's in `.env.local`
   - Primary Certificate in console matches `.env.local`

### Step 3: Test Video Call

1. **Start a video call** (basic functionality)
2. **Verify video works** - make sure basic calling still works with new credentials
3. **Check for any errors** in browser console

### Step 4: Test Recording

1. **Click record button** in video call
2. **Check server logs** for:
   ```
   [Recording Service] Using App ID: xxxxxxxx...
   [Recording Service] Using Certificate: xxxxxxxx...
   ```
3. **Verify new credentials** are being used (should match new project)
4. **Check for 401 errors** - should be gone if Cloud Recording is enabled

## Common Issues with New Project

### Issue: Still Getting 401

**Possible causes:**
- Cloud Recording not enabled in new project
- Server not restarted after updating .env.local
- Credentials don't match what's in console

**Solution:**
1. Verify Cloud Recording is enabled in Features tab
2. Restart dev server
3. Double-check credentials match exactly

### Issue: Video Call Doesn't Work

**Possible causes:**
- App ID/Certificate mismatch
- Token generation failing

**Solution:**
1. Test token endpoint: `/api/video-call/token`
2. Check browser console for errors
3. Verify credentials are correct

## Success Indicators

✅ Test endpoint shows new App ID and Certificate  
✅ Cloud Recording enabled in Features tab  
✅ Video calls work normally  
✅ Recording starts without 401 errors  
✅ Server logs show new credentials being used  

## Next Steps

After verifying:
1. Test full recording flow (start → stop)
2. Verify file appears in Backblaze B2
3. Check recordings page displays the recording

