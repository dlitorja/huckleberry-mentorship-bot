# WebSocket Ping Timeout Warning - Fix Guide

## What This Warning Means

The warning `[client-31f59] ws request timeout, type: ping` indicates:
- Agora SDK is trying to maintain a WebSocket connection
- The ping (keepalive) message is timing out
- This can indicate network issues, firewall blocking, or connection instability

## Is This Causing Your Video Issue?

**Possibly!** If the WebSocket connection is unstable:
- Video may not load properly
- Connection might drop intermittently
- Media tracks might not be published/subscribed correctly

## Quick Checks

### 1. Check Connection State

Open browser console and check:

```javascript
// Check if client is connected
console.log('Connection state:', clientRef.current?.connectionState);
```

**Expected states:**
- `CONNECTING` - Initial connection
- `CONNECTED` - Connected and working
- `RECONNECTING` - Lost connection, trying to reconnect
- `DISCONNECTED` - Not connected
- `FAILED` - Connection failed

### 2. Check Network Tab

In browser DevTools → Network tab:
- Look for WebSocket connections (filter by "WS")
- Check if they're staying connected (green) or failing (red)
- Look for any blocked or failed requests

### 3. Check for Other Errors

Look in console for:
- `Connection lost` errors
- `Failed to join channel` errors
- Any other Agora SDK errors

## Solutions

### Solution 1: Network/Firewall Issues

**If you're behind a firewall or corporate network:**

1. **Check firewall settings** - Allow WebSocket connections
2. **Try different network** - Test on mobile hotspot or different WiFi
3. **Check proxy settings** - Some proxies block WebSocket connections
4. **VPN issues** - Disable VPN if active

### Solution 2: Browser/Extension Issues

1. **Disable browser extensions** - Some extensions block WebSocket
2. **Try incognito/private mode** - Bypasses extensions
3. **Clear browser cache** - Sometimes helps with connection issues
4. **Try different browser** - Isolates browser-specific issues

### Solution 3: Agora Configuration

The warning might be harmless if:
- Connection eventually succeeds
- Video still works despite the warning
- It only appears occasionally

**If video works despite the warning:**
- You can ignore it (it's just a warning)
- Or reduce Agora log level to hide warnings

### Solution 4: Add Connection Monitoring

I've added connection state monitoring to the code. Check your console for:
```
[Agora] Connection state changed: CONNECTING -> CONNECTED
```

This will help you see if the connection is actually working.

## Debugging Steps

### Step 1: Check if Video Actually Works

Despite the warning, check:
1. **Can you see your video?** (even if delayed)
2. **Can others see your video?**
3. **Is audio working?**

If video works, the warning might be harmless.

### Step 2: Monitor Connection

Watch the console for:
- Connection state changes
- Any error messages
- Whether connection eventually succeeds

### Step 3: Test Network

```javascript
// Test WebSocket connectivity
const ws = new WebSocket('wss://api.agora.io');
ws.onopen = () => console.log('✅ WebSocket works');
ws.onerror = (err) => console.error('❌ WebSocket error:', err);
```

## Common Causes

1. **Slow/unstable network** - High latency causes timeouts
2. **Firewall blocking** - Corporate/school networks often block WebSocket
3. **VPN interference** - Some VPNs interfere with WebSocket
4. **Browser extensions** - Ad blockers or privacy extensions
5. **Proxy server** - Corporate proxies can block WebSocket
6. **Mobile network** - Some mobile carriers have issues

## If Video Still Doesn't Work

If you see the warning AND video doesn't work:

1. **Check camera permissions** (separate issue)
2. **Check if connection eventually succeeds** (wait a few seconds)
3. **Try refreshing the page**
4. **Check for other errors** in console
5. **Test on different network** (mobile hotspot)

## Reducing Warning Noise

If the warning is harmless but annoying, you can:

```typescript
// In useAgoraVideoCall.ts, reduce log level
AgoraRTC.setLogLevel(2); // Only show errors, hide warnings
```

## Next Steps

1. **Check connection state** in console
2. **See if video works** despite the warning
3. **Try different network** if it doesn't work
4. **Check for other errors** that might be the real issue

The warning alone might not be the problem - it could be a symptom of a network issue that's also preventing video from working.

