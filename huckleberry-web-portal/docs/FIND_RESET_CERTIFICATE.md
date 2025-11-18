# Finding App Certificate Reset Option in Agora Console

## Where to Look

The App Certificate reset option might be in different locations depending on your Agora Console version:

### Option 1: Config Tab (Most Common)

1. **Go to:** Agora Console → Your Project
2. **Navigate to:** Project Management → **Config** tab
3. **Look for:** Primary Certificate section
4. **Check for:**
   - "Reset" button
   - "Regenerate" button
   - Three dots menu (⋯) next to the certificate
   - Edit icon (pencil)
   - Refresh icon

### Option 2: Security Tab

1. **Go to:** Agora Console → Your Project
2. **Navigate to:** Project Management → **Security** tab (if available)
3. **Look for:** Certificate management options

### Option 3: Project Settings

1. **Go to:** Agora Console → Your Project
2. **Click:** Settings or Project Settings
3. **Look for:** Certificate or Security section

## If You Can't Find Reset Option

### Option A: Verify Current Certificate is Correct

Since you can't regenerate, let's make sure the certificate you have is correct:

1. **In Agora Console:**
   - Go to Project Management → Config
   - Click "Show" next to Primary Certificate
   - Copy the full certificate

2. **Compare with `.env.local`:**
   - Open `.env.local`
   - Check if `AGORA_APP_CERTIFICATE` matches exactly
   - First 8 characters should be `f1529123...`

3. **If they match:**
   - The certificate is correct
   - The issue might be Cloud Recording permissions
   - See "Option B" below

4. **If they don't match:**
   - Update `.env.local` with the certificate from console
   - Restart dev server
   - Try again

### Option B: Check Cloud Recording Permissions

The certificate might be correct but lack Cloud Recording permissions:

1. **Go to:** Agora Console → Your Project
2. **Navigate to:** Project Management → **Features** tab
3. **Find:** Cloud Recording section
4. **Check:**
   - Is Cloud Recording enabled/active?
   - Are there any restrictions or warnings?
   - Does your account type support Cloud Recording?

### Option C: Contact Agora Support

If you can't find the reset option and the certificate is correct:

1. **Check your account type:**
   - Free tier might have limitations
   - Some accounts need to enable Cloud Recording separately

2. **Contact Agora Support:**
   - Provide your App ID
   - Explain you're getting 401 errors for Cloud Recording
   - Ask them to verify Cloud Recording is enabled for your project
   - Ask if the certificate needs to be regenerated

## Alternative: Use Secondary Certificate

If you have a Secondary Certificate that's enabled:

1. **In Agora Console:**
   - Go to Project Management → Config
   - Find Secondary Certificate
   - Make sure it's enabled (toggle is on)
   - Click "Show" and copy it

2. **Update `.env.local`:**
   ```env
   AGORA_APP_CERTIFICATE=secondary_certificate_here
   ```

3. **Restart dev server**

4. **Test again**

## Quick Verification Steps

1. **Verify certificate in console matches `.env.local`:**
   - Console: First 8 chars = `f1529123...`
   - `.env.local`: Should also start with `f1529123...`

2. **If they match:**
   - Certificate is correct
   - Issue is likely permissions
   - Check Cloud Recording is enabled in Features tab

3. **If they don't match:**
   - Update `.env.local` with certificate from console
   - Restart server
   - Test again

## What to Check Right Now

1. **In Agora Console → Config:**
   - Click "Show" on Primary Certificate
   - Note the first 8 characters
   - Does it start with `f1529123...`?

2. **If yes:** Certificate matches, check Cloud Recording permissions
3. **If no:** Update `.env.local` with the correct certificate

