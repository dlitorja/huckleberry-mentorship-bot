# Troubleshooting 404 Errors on Test Page

## Issue: 404 errors for Next.js static chunks

If you're seeing 404 errors for files like:
- `_next/static/chunks/main-app.js`
- `_next/static/chunks/app/(dashboard)/video-call/test/page.js`

## Solutions (try in order):

### Solution 1: Hard Refresh Browser
1. **Chrome/Edge:** Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. **Firefox:** Press `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)
3. Or open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

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
5. **Hard refresh browser** (Solution 1)

### Solution 4: Check Dev Server Logs
Look at the terminal where `npm run dev` is running:
- Are there any compilation errors?
- Does it say "Ready"?
- Are there any warnings about missing files?

### Solution 5: Try Incognito/Private Window
1. Open a new incognito/private window
2. Navigate to `http://localhost:3000/video-call/test`
3. This bypasses browser cache completely

### Solution 6: Verify Route Structure
Make sure the file exists at:
```
app/(dashboard)/video-call/test/page.tsx
```

### Solution 7: Check Port Conflicts
If port 3000 is in use by another process:
```bash
# Check what's using port 3000
lsof -i :3000

# Or use a different port
npm run dev -- -p 3001
# Then access: http://localhost:3001/video-call/test
```

## Common Causes

1. **Browser cache** - Most common cause
2. **Stale build artifacts** - `.next` directory needs clearing
3. **Dev server not fully started** - Wait for "Ready" message
4. **Port conflict** - Another process using port 3000
5. **File system sync issues** (WSL) - Files not synced properly

## Still Not Working?

1. Check the terminal output for compilation errors
2. Verify the dev server is actually running on port 3000
3. Try accessing other pages (like `/dashboard`) to see if it's a general issue
4. Check browser console for more detailed error messages

