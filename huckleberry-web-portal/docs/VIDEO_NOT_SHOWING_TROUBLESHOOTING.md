# Video Not Showing - Troubleshooting Guide

## Quick Checks

### 1. Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab for errors:

**Look for:**
- `[VideoCall] Failed to play local video` - Video rendering error
- `NotAllowedError` or `Permission denied` - Camera permission issue
- `NotFoundError` - Camera not found
- `OverconstrainedError` - Camera constraints issue
- Any Agora SDK errors

### 2. Check Camera Permissions

**Chrome/Edge:**
1. Click the lock icon in the address bar
2. Check "Camera" permission - should be "Allow"
3. If blocked, click and change to "Allow"

**Firefox:**
1. Click the shield icon in the address bar
2. Check camera permissions
3. Allow if blocked

**Safari:**
1. Safari → Settings → Websites → Camera
2. Ensure your site has camera access

### 3. Check What You See

**What do you see in the video call?**
- [ ] Black screen with "Loading camera..." spinner
- [ ] Black screen with "Camera Off" message
- [ ] Completely blank/empty container
- [ ] Error message displayed
- [ ] Video container exists but no video element

## Common Issues & Solutions

### Issue 1: Camera Permission Denied

**Symptoms:**
- Browser console shows: `NotAllowedError: Permission denied`
- Video container shows "Loading camera..." indefinitely
- Browser shows permission prompt but you denied it

**Solution:**
1. **Reset permissions:**
   - Chrome: Settings → Privacy and Security → Site Settings → Camera → Remove your site, then reload
   - Firefox: Click address bar lock icon → More Information → Permissions → Reset Camera
2. **Reload the page** and allow camera access when prompted
3. **Check browser settings** - some browsers block camera access globally

### Issue 2: No Camera Found

**Symptoms:**
- Browser console shows: `NotFoundError: No camera found`
- Video container shows error

**Solution:**
1. **Check if camera is connected** (for external cameras)
2. **Check if camera is being used by another app** (close other apps)
3. **Try a different browser** to test if it's browser-specific
4. **Check system permissions** (macOS: System Settings → Privacy → Camera)

### Issue 3: Video Track Not Created

**Symptoms:**
- `localVideoTrack` is null
- Video container shows "Loading camera..." but never loads
- No errors in console

**Check:**
1. Open browser console
2. Type: `navigator.mediaDevices.getUserMedia({ video: true })`
3. If this fails, it's a browser/permission issue
4. If it succeeds, the issue is in the Agora SDK integration

**Solution:**
- Check if `joinChannel` is being called
- Verify `AgoraRTC.createCameraVideoTrack()` is succeeding
- Check for errors in the `joinChannel` function

### Issue 4: Video Element Not Rendered

**Symptoms:**
- `localVideoTrack` exists (not null)
- Video container exists
- But no `<video>` element inside

**Check:**
1. Open browser DevTools → Elements tab
2. Find the video container (look for `ref={localVideoRef}`)
3. Check if there's a `<video>` element inside
4. If missing, the `play()` method failed

**Solution:**
- Check browser console for `play()` errors
- Verify video track is enabled: `localVideoTrack.isPlaying`
- Try manually: `localVideoTrack.play(container)`

### Issue 5: Video Track Disabled

**Symptoms:**
- Video was working but now shows "Camera Off"
- `isVideoEnabled` is false

**Solution:**
- Click the video toggle button (camera icon) to enable
- Check if video was accidentally disabled

### Issue 6: Browser Compatibility

**Symptoms:**
- Works in one browser but not another
- Older browser versions

**Solution:**
- **Chrome/Edge**: Version 60+ required
- **Firefox**: Version 60+ required
- **Safari**: Version 11+ required (may need additional setup)
- **Mobile browsers**: May have limitations

## Debugging Steps

### Step 1: Check Video Track State

Open browser console and check:

```javascript
// Check if video track exists
console.log('Video track:', localVideoTrack);
console.log('Is playing:', localVideoTrack?.isPlaying);
console.log('Is enabled:', localVideoTrack?.isEnabled);
```

### Step 2: Check Call State

```javascript
// Check call state
console.log('Call state:', callState);
console.log('Client ready:', isClientReady);
```

### Step 3: Test Camera Directly

```javascript
// Test camera access directly
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    console.log('Camera works!', stream);
    // Create video element to test
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    document.body.appendChild(video);
  })
  .catch(err => {
    console.error('Camera error:', err);
  });
```

### Step 4: Check Agora Client

```javascript
// Check if Agora client is initialized
console.log('Agora client:', clientRef.current);
console.log('Connection state:', clientRef.current?.connectionState);
```

## Quick Fixes to Try

1. **Refresh the page** - Sometimes fixes permission issues
2. **Restart browser** - Clears cached permissions
3. **Try incognito/private mode** - Bypasses extension issues
4. **Check browser extensions** - Some extensions block camera access
5. **Update browser** - Ensure you're on latest version
6. **Try different browser** - Isolates browser-specific issues
7. **Check HTTPS** - Camera requires HTTPS (or localhost)

## Still Not Working?

### Check Server Logs

Look for errors when joining the call:
- Token generation errors
- Agora API errors
- Database errors

### Check Network Tab

In browser DevTools → Network tab:
- Check if `/api/video-call/token` returns 200
- Check if `/api/video-call/start` returns 200
- Look for any failed requests

### Enable Agora Debug Logs

Add to your code temporarily:

```typescript
// In useAgoraVideoCall hook
AgoraRTC.setLogLevel(4); // Enable all logs
```

This will show detailed Agora SDK logs in the console.

## Getting Help

If none of the above works, collect this information:

1. **Browser and version** (e.g., Chrome 120)
2. **Operating system** (e.g., Windows 11, macOS 14)
3. **Console errors** (screenshot or copy/paste)
4. **Network tab** (any failed requests)
5. **What you see** (screenshot of the video call page)
6. **Steps to reproduce** (what you did before the issue)

