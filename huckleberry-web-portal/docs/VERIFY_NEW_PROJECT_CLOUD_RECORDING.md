# Verify Cloud Recording in New Agora Project

## Current Status

✅ New credentials loaded correctly:
- App ID: `6b894724...`
- Certificate: `7f8711bf...`
- Both 32 characters

❌ Still getting 401: "Invalid authentication credentials"

## This Means Cloud Recording is NOT Enabled

Even with a new project, Cloud Recording must be explicitly enabled. It's not automatically enabled by default.

## Step-by-Step: Enable Cloud Recording

### Step 1: Go to Your New Project

1. **Agora Console:** https://console.agora.io/
2. **Select your NEW project** (the one with App ID `6b894724...`)
3. **Make sure you're in the right project** - check App ID matches

### Step 2: Navigate to Features

1. **Click:** Project Management (left sidebar)
2. **Click:** Features tab (at the top)
3. **Look for:** "Cloud Recording" section

### Step 3: Enable Cloud Recording

**If you see Cloud Recording:**
- Toggle it **ON** (if it's off)
- Click **Save** or **Apply**
- Wait 2-3 minutes for changes to take effect

**If you DON'T see Cloud Recording:**
- Your account type might not support it
- You may need to upgrade your Agora plan
- Contact Agora support

### Step 4: Verify It's Enabled

1. **Refresh the Features page**
2. **Check Cloud Recording shows as "Enabled" or "Active"**
3. **Look for any warnings or restrictions**

## Alternative: Check via API

You can also verify by checking your project settings via Agora's REST API, but the easiest way is through the Console.

## Common Issues

### Issue: Features Tab Doesn't Show Cloud Recording

**Possible causes:**
- Free tier account doesn't have access
- Account needs to be upgraded
- Feature not available in your region

**Solution:**
- Check your account type/plan
- Contact Agora support to enable Cloud Recording
- Consider upgrading if on free tier

### Issue: Cloud Recording is Disabled

**Solution:**
- Enable it in Features tab
- Wait a few minutes
- Try recording again

### Issue: Enabled But Still 401

**Possible causes:**
- Changes haven't propagated yet (wait 5-10 minutes)
- Wrong project (check App ID matches)
- Certificate issue (verify it matches console)

**Solution:**
- Wait 5-10 minutes after enabling
- Double-check you're using the right project
- Verify certificate in console matches `.env.local`

## Verification Checklist

- [ ] In the correct project (App ID: `6b894724...`)
- [ ] Features tab is visible
- [ ] Cloud Recording section exists
- [ ] Cloud Recording is toggled ON/Enabled
- [ ] No warnings or restrictions shown
- [ ] Waited 2-3 minutes after enabling
- [ ] Tried recording again

## Still Getting 401?

If Cloud Recording is enabled and you still get 401:

1. **Wait 5-10 minutes** - Changes can take time to propagate
2. **Verify project** - Make sure App ID in console matches `6b894724...`
3. **Check certificate** - Verify Primary Certificate in console matches `7f8711bf...`
4. **Contact Agora Support:**
   - App ID: `6b894724...`
   - Explain you enabled Cloud Recording but still get 401
   - Ask them to verify Cloud Recording is active for your project

## Quick Test

After enabling Cloud Recording:

1. **Wait 2-3 minutes**
2. **Try recording again**
3. **Check server logs** - should see success, not 401
4. **If still 401, wait 5 more minutes and try again**

The 401 error with correct credentials almost always means Cloud Recording isn't enabled. Even new projects require you to enable it manually.

