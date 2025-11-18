# Fix 401 Unauthorized Error for Cloud Recording

## Error Message

```
Error starting cloud recording: Error [AxiosError]: Request failed with status code 401
```

## What This Means

A **401 Unauthorized** error means Agora rejected your authentication credentials when trying to start cloud recording. This is different from regular video calling - cloud recording requires specific permissions.

## Common Causes

### 1. App Certificate Doesn't Have Cloud Recording Permissions ⚠️ MOST LIKELY

**Solution:**
1. Go to [Agora Console](https://console.agora.io/)
2. Select your project
3. Go to **Project Management** → **Config**
4. **Regenerate your App Certificate**:
   - Click "Reset" or "Regenerate" next to App Certificate
   - Copy the new certificate
   - Update `.env.local` with the new certificate
   - **Restart your dev server**
5. **Verify Cloud Recording is enabled** in Project Management → Features

### 2. App Certificate is Incorrect

**Check:**
- Certificate in `.env.local` matches what's in Agora Console
- No extra spaces or quotes around the certificate
- Certificate is the full 32-character string

**Solution:**
- Copy certificate directly from Agora Console (click "Show")
- Paste into `.env.local` without quotes
- Restart dev server

### 3. App ID is Incorrect

**Check:**
- App ID in `.env.local` matches Agora Console
- App ID is correct for the project with Cloud Recording enabled

**Solution:**
- Verify App ID in Agora Console
- Update `.env.local` if different
- Restart dev server

### 4. Cloud Recording Not Enabled for Project

**Check:**
1. Go to Agora Console → Your Project
2. **Project Management** → **Features** tab
3. Verify "Cloud Recording" is **enabled/active**

**Solution:**
- Enable Cloud Recording if it's disabled
- Some projects require enabling it explicitly
- May need to contact Agora support if you can't enable it

## Step-by-Step Fix

### Step 1: Verify Credentials

1. **Check `.env.local`:**
   ```env
   NEXT_PUBLIC_AGORA_APP_ID=your_app_id
   AGORA_APP_CERTIFICATE=your_certificate
   ```

2. **Verify in Agora Console:**
   - Go to Project Management → Config
   - Compare App ID and Certificate
   - Make sure they match exactly

### Step 2: Regenerate App Certificate

**This is often the fix:**

1. **In Agora Console:**
   - Project Management → Config
   - Click "Reset" or "Regenerate" next to App Certificate
   - **Copy the new certificate immediately** (only shown once)

2. **Update `.env.local`:**
   ```env
   AGORA_APP_CERTIFICATE=new_certificate_here
   ```

3. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Step 3: Verify Cloud Recording is Enabled

1. **Agora Console** → Your Project
2. **Project Management** → **Features** tab
3. **Find "Cloud Recording"**
4. **Enable it** if disabled
5. **Save changes**

### Step 4: Test Again

1. **Start a video call**
2. **Click record button**
3. **Check server logs** - should see success, not 401 error

## Verification

After fixing, test the configuration:

```bash
# Visit this URL to verify credentials are loaded
http://localhost:3000/api/test-agora-config
```

Should show:
- ✅ Configured: true
- Certificate exists and is valid

## Still Getting 401?

### Check Server Logs

The improved error handling will now show:
- Detailed error message from Agora
- Specific guidance on what might be wrong
- HTTP status and response data

### Verify API Access

Some Agora accounts have restrictions:
- **Free tier**: May have limited cloud recording access
- **Paid tier**: Full access to cloud recording
- **Trial accounts**: May need to upgrade

### Contact Agora Support

If none of the above works:
1. Check your Agora account type/plan
2. Verify cloud recording is available for your account
3. Contact Agora support with:
   - Your App ID
   - Error message
   - Steps to reproduce

## Prevention

To avoid this in the future:
1. **Keep App Certificate secure** - don't commit to git
2. **Document which certificate is active** - note when you regenerate
3. **Test recording after any credential changes**
4. **Use environment variables** - never hardcode credentials

## Quick Checklist

- [ ] App Certificate regenerated in Agora Console
- [ ] New certificate copied to `.env.local`
- [ ] Dev server restarted after updating `.env.local`
- [ ] Cloud Recording enabled in Agora Console
- [ ] App ID matches Agora Console
- [ ] Test endpoint shows credentials are loaded
- [ ] Tried recording again - still getting 401?

If you've done all of the above and still get 401, the issue might be:
- Account/plan restrictions
- Agora API temporary issue
- Need to contact Agora support

