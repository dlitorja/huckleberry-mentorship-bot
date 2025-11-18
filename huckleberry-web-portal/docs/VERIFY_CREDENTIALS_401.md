# Verify Credentials for 401 Error

## Current Error

```
[Cloud Recording] HTTP 401 Unauthorized: { message: 'Invalid authentication credentials' }
```

This means Agora is rejecting your App ID or App Certificate.

## Quick Verification Steps

### Step 1: Verify Credentials Are Loaded

1. **Visit the test endpoint:**
   ```
   http://localhost:3000/api/test-agora-config
   ```

2. **Check the response:**
   - Should show `configured: true`
   - App ID should be 32 characters
   - Certificate should be 32 characters

### Step 2: Verify Certificate in Agora Console

1. **Go to Agora Console:** https://console.agora.io/
2. **Select your project**
3. **Go to:** Project Management → Config
4. **Click "Show"** next to Primary Certificate
5. **Compare first 8 characters** with what's in your `.env.local`

**Important:** The certificate in `.env.local` should match exactly what's shown in Agora Console.

### Step 3: Check Server Logs

After trying to record, check your server logs. You should now see:
```
[Recording Service] Using App ID: 1be79e63...
[Recording Service] Using Certificate: 6d8e5779...
[Recording Service] Certificate length: 32
```

**Verify:**
- App ID matches what's in Agora Console
- Certificate matches what's in Agora Console (first 8 chars)
- Certificate length is 32 (not 0, not some other number)

### Step 4: Common Issues

#### Issue: Certificate Not Updated After Copying

**Symptoms:**
- Certificate in logs doesn't match Agora Console
- Certificate length is wrong

**Solution:**
1. Copy certificate from Agora Console again
2. Update `.env.local`:
   ```env
   AGORA_APP_CERTIFICATE=paste_here_no_quotes
   ```
3. **Restart dev server** (very important!)
4. Try recording again

#### Issue: Wrong Certificate

**Symptoms:**
- Using Secondary Certificate when Primary is needed
- Certificate doesn't match what's in console

**Solution:**
- Use **Primary Certificate** (not Secondary)
- Make sure it matches exactly what's in Agora Console

#### Issue: Extra Spaces/Characters

**Symptoms:**
- Certificate length is not 32
- Has quotes or spaces

**Solution:**
- Remove any quotes around the certificate
- Remove leading/trailing spaces
- Should be exactly 32 characters, no more, no less

#### Issue: App ID Mismatch

**Symptoms:**
- App ID in logs doesn't match Agora Console

**Solution:**
- Verify App ID in `.env.local` matches Agora Console
- Should be exactly 32 characters

## Step-by-Step Fix

1. **Open Agora Console** → Your Project → Config
2. **Click "Show"** on Primary Certificate
3. **Copy the entire certificate** (all 32 characters)
4. **Open `.env.local`** in your project
5. **Update the line:**
   ```env
   AGORA_APP_CERTIFICATE=paste_certificate_here
   ```
   - No quotes
   - No spaces
   - Exact match
6. **Save the file**
7. **Stop your dev server** (Ctrl+C)
8. **Restart dev server:**
   ```bash
   npm run dev
   ```
9. **Verify credentials loaded:**
   - Visit: `http://localhost:3000/api/test-agora-config`
   - Check certificate matches
10. **Try recording again**

## Still Getting 401?

If you've verified everything above and still get 401:

1. **Regenerate App Certificate:**
   - Agora Console → Config
   - Click "Reset" next to Primary Certificate
   - Copy new certificate
   - Update `.env.local`
   - Restart server

2. **Check Account Permissions:**
   - Verify your Agora account has Cloud Recording enabled
   - Some free/trial accounts may have restrictions
   - Check Project Management → Features → Cloud Recording

3. **Verify App ID:**
   - Make sure you're using the App ID from the same project
   - App ID and Certificate must be from the same project

4. **Check Server Logs:**
   - Look for the credential info I added
   - Verify App ID and Certificate are being used correctly

## Debugging Output

The code now logs credential information. When you try to record, check server logs for:

```
[Recording Service] Using App ID: xxxxxxxx...
[Recording Service] Using Certificate: xxxxxxxx...
[Recording Service] Certificate length: 32
```

Compare these with what's in Agora Console to verify they match.

