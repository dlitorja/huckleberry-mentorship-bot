# Cloud Recording Not Enabled - 401 Error Fix

## Current Situation

Your credentials are correct:
- ✅ App ID: 32 characters, loaded correctly
- ✅ Certificate: 32 characters, loaded correctly
- ❌ Still getting 401: "Invalid authentication credentials"

This typically means **Cloud Recording is not enabled** for your project or account.

## How to Enable Cloud Recording

### Step 1: Check Features Tab

1. **Go to Agora Console:** https://console.agora.io/
2. **Select your project**
3. **Navigate to:** Project Management → **Features** tab
4. **Look for:** "Cloud Recording" section

### Step 2: Enable Cloud Recording

**If you see Cloud Recording:**
- Toggle it **ON** if it's off
- Click **Save** or **Apply**
- Wait a few minutes for changes to take effect

**If you DON'T see Cloud Recording:**
- Your account type might not support it
- You may need to upgrade your plan
- Contact Agora support

### Step 3: Verify Account Type

**Check your Agora account:**
1. Go to **Account** or **Billing** section
2. Check your plan type:
   - **Free Tier:** May have limited Cloud Recording access
   - **Paid Tier:** Should have full access
   - **Trial:** May need to upgrade

**Free Tier Limitations:**
- Some free accounts don't have Cloud Recording enabled by default
- May need to contact Agora to enable it
- Or upgrade to a paid plan

## Alternative: Check if Recording is Available

### Test with Agora Support

If you can't find Cloud Recording in Features:

1. **Contact Agora Support:**
   - Go to Agora Console → Support
   - Create a ticket explaining:
     - You're getting 401 errors for Cloud Recording API
     - Your App ID: `1be79e63...`
     - Ask if Cloud Recording is enabled for your project
     - Ask if your account type supports Cloud Recording

2. **Check Documentation:**
   - Verify your account type supports Cloud Recording
   - Some features require specific account tiers

## Quick Verification

### What to Check in Agora Console:

1. **Features Tab:**
   - [ ] Cloud Recording section exists
   - [ ] Cloud Recording is enabled/toggled ON
   - [ ] No warnings or restrictions shown

2. **Account/Billing:**
   - [ ] Account type supports Cloud Recording
   - [ ] No payment/upgrade required

3. **Project Settings:**
   - [ ] Project is active (not suspended)
   - [ ] No restrictions on the project

## If Cloud Recording is Enabled But Still 401

If Cloud Recording is enabled and you still get 401:

1. **Wait a few minutes** - Changes can take time to propagate
2. **Try again** - Sometimes there's a delay
3. **Check API endpoint** - Make sure you're using the correct API version
4. **Verify authentication format** - Should be `Basic base64(appId:certificate)`

## Next Steps

1. **Check Features tab** in Agora Console
2. **Enable Cloud Recording** if it's disabled
3. **Verify account type** supports Cloud Recording
4. **Contact Agora support** if you can't find the option
5. **Try recording again** after enabling

## Common Scenarios

### Scenario 1: Feature Not Visible
- **Cause:** Account doesn't support Cloud Recording
- **Solution:** Upgrade account or contact Agora

### Scenario 2: Feature Disabled
- **Cause:** Cloud Recording is turned off
- **Solution:** Enable it in Features tab

### Scenario 3: Feature Enabled But 401
- **Cause:** Permissions not propagated yet
- **Solution:** Wait 5-10 minutes and try again

## Still Stuck?

If you've checked everything and still get 401:

1. **Screenshot the Features tab** - Show what you see
2. **Check account type** - Free/Paid/Trial
3. **Contact Agora Support** with:
   - App ID
   - Error message
   - Screenshot of Features tab
   - Ask specifically about Cloud Recording access

The 401 error with correct credentials almost always means Cloud Recording isn't enabled for your project/account.

