# Verify Agora App Certificate

## Step 1: Check Certificate in Agora Console

1. **Go to Agora Console**: https://console.agora.io/
2. **Select your project**
3. **Navigate to**: **Project Management** → **Config** tab
4. **Find "App Certificate"** section
5. **Verify**:
   - Certificate is shown (not hidden)
   - Status shows as "Active" or "Enabled"
   - If it says "Disabled" or "Inactive", you may need to enable it

## Step 2: Copy Certificate to .env.local

1. **In Agora Console**, click **"Show"** next to App Certificate
2. **Copy the entire certificate string** (it's a long alphanumeric string)
3. **Paste it into your `.env.local`** file:
   ```env
   AGORA_APP_CERTIFICATE=your_certificate_string_here
   ```
4. **Important**: 
   - No spaces or quotes around the certificate
   - Copy the entire string (it's usually 32+ characters)
   - Make sure there are no line breaks

## Step 3: Verify Environment Variable is Loaded

### Option A: Check in Code (Quick Test)

Create a test API route to verify the certificate is loaded:

```typescript
// app/api/test-agora/route.ts (temporary test file)
import { NextResponse } from 'next/server';
import { ENV_CONFIG } from '@/src/config/environment';

export async function GET() {
  const hasAppId = !!ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID;
  const hasCertificate = !!ENV_CONFIG.AGORA_APP_CERTIFICATE;
  const appIdLength = ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID?.length || 0;
  const certLength = ENV_CONFIG.AGORA_APP_CERTIFICATE?.length || 0;

  return NextResponse.json({
    configured: hasAppId && hasCertificate,
    appId: {
      exists: hasAppId,
      length: appIdLength,
      preview: hasAppId ? `${ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID.substring(0, 8)}...` : 'missing'
    },
    certificate: {
      exists: hasCertificate,
      length: certLength,
      preview: hasCertificate ? `${ENV_CONFIG.AGORA_APP_CERTIFICATE.substring(0, 8)}...` : 'missing'
    }
  });
}
```

Then visit: `http://localhost:3000/api/test-agora`

### Option B: Check Server Logs

When you start your dev server, check for any errors about missing Agora configuration.

### Option C: Test Token Generation

Try generating a token (this will fail if certificate is wrong):

```bash
# Test the token API endpoint
curl -X POST http://localhost:3000/api/video-call/token \
  -H "Content-Type: application/json" \
  -d '{"mentorshipId": "test-id"}'
```

If you get an error about "Agora App ID and Certificate are required", the certificate isn't loaded.

## Step 4: Common Issues

### Issue: Certificate Not Loading

**Symptoms:**
- Error: "Agora App ID and Certificate are required"
- Token generation fails

**Solutions:**
1. **Restart your dev server** after adding/changing `.env.local`
2. **Check file location**: `.env.local` should be in `huckleberry-web-portal/` directory
3. **Check variable name**: Must be exactly `AGORA_APP_CERTIFICATE` (case-sensitive)
4. **Check for quotes**: Don't wrap the value in quotes
5. **Check for spaces**: No leading/trailing spaces

### Issue: Invalid Certificate

**Symptoms:**
- Error: "Failed to acquire recording resource: 401"
- Error: "Unauthorized" when calling Agora APIs

**Solutions:**
1. **Regenerate certificate** in Agora Console:
   - Go to Project Management → Config
   - Click "Reset" or "Regenerate" next to App Certificate
   - Copy the new certificate
   - Update `.env.local`
   - Restart dev server
2. **Verify certificate matches** what's in Agora Console
3. **Check for typos** in the certificate string

### Issue: Certificate Disabled

**Symptoms:**
- Certificate shows as "Disabled" in Agora Console

**Solutions:**
1. **Enable the certificate** in Agora Console
2. Some projects require certificates to be explicitly enabled
3. Contact Agora support if you can't enable it

## Step 5: Test Recording with Certificate

Once verified, test the full flow:

1. **Start a video call**
2. **Click record button**
3. **Check server logs** for:
   - `[Video Recordings]` messages
   - Any "401" or "Unauthorized" errors
4. **If you see 401 errors**, the certificate is likely wrong

## Quick Verification Checklist

- [ ] App Certificate is visible in Agora Console
- [ ] Certificate status is "Active" or "Enabled"
- [ ] Certificate is copied to `.env.local` as `AGORA_APP_CERTIFICATE`
- [ ] No quotes or spaces around the certificate value
- [ ] Dev server has been restarted after adding certificate
- [ ] Test API shows certificate is loaded (if using test route)
- [ ] Token generation works (no "required" errors)
- [ ] Recording API calls don't return 401 errors

## Next Steps

After verifying the certificate:
1. ✅ Test recording start functionality
2. ✅ Test recording stop functionality  
3. ✅ Verify files are stored in Backblaze B2
4. ✅ Test video playback

