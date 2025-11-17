# Webhook Secret Setup Guide

## Overview

Webhook signature verification has been added to secure your Kajabi webhook endpoints. This prevents unauthorized requests from being processed.

## Finding Your Kajabi Webhook Secret

Kajabi may not provide a traditional webhook secret. Here are your options:

### Option 1: Check Kajabi Webhook Settings

1. Log into your Kajabi dashboard
2. Go to **Settings** → **Integrations** → **Webhooks**
3. Open your webhook configuration
4. Look for:
   - "Secret" or "Signing Secret" field
   - "Webhook Secret" 
   - Any security/authentication settings

### Option 2: Use Kajabi API Credentials

If Kajabi doesn't provide a webhook secret, you can:
1. Go to **Settings** → **Account Details**
2. Find your **API Secret**
3. Use this as your `WEBHOOK_SECRET` (though this is less ideal)

### Option 3: Generate Your Own Secret

If Kajabi allows you to configure a custom secret:
1. Generate a secure random secret (see below)
2. Configure it in both:
   - Your `.env` file as `WEBHOOK_SECRET`
   - Your Kajabi webhook settings (if they support custom secrets)

## Generating a Secure Secret

Run this command to generate a secure 64-character hex secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use an online generator: https://randomkeygen.com/

## Configuration

### 1. Add to `.env` file

```env
WEBHOOK_SECRET=your_generated_secret_here
```

### 2. For Production (Fly.io)

```bash
fly secrets set WEBHOOK_SECRET=your_generated_secret_here
```

## Verification Modes

### Optional Verification (Default)

If `WEBHOOK_SECRET` is not set, webhooks will still be processed but a warning will be logged. This is useful for:
- Testing
- If Kajabi doesn't support webhook signatures
- Gradual migration

### Required Verification

To require verification (reject requests without valid signatures), set:

```env
REQUIRE_WEBHOOK_VERIFICATION=true
WEBHOOK_SECRET=your_secret_here
```

## Testing

1. **Check if Kajabi sends signatures:**
   - Look at your server logs when a webhook arrives
   - Check for messages like "Available headers:" to see what Kajabi sends
   - Look for headers containing "signature", "kajabi", or "webhook"

2. **Test with secret:**
   - Set `WEBHOOK_SECRET` in your `.env`
   - Trigger a test purchase in Kajabi
   - Check logs for "✅ Webhook signature verified successfully" or error messages

3. **If verification fails:**
   - Check that the secret matches what's configured in Kajabi (if applicable)
   - Verify the signature header name matches what Kajabi sends
   - Check server logs for the actual header names received

## Troubleshooting

### "Webhook secret not configured. Skipping verification."
- **Meaning:** No secret is set, but webhooks are still being processed
- **Action:** Set `WEBHOOK_SECRET` if you want verification enabled

### "Webhook request missing signature header"
- **Meaning:** Kajabi may not be sending a signature header
- **Action:** 
  - Check the "Available headers" log to see what Kajabi actually sends
  - You may need to adjust `extractSignatureFromHeaders()` to match Kajabi's header format
  - Or disable verification if Kajabi doesn't support it

### "Invalid webhook signature"
- **Meaning:** The signature doesn't match
- **Action:**
  - Verify the secret matches in both places
  - Check if Kajabi uses a different signature algorithm
  - Ensure the raw body is being captured correctly

## Current Implementation

The verification middleware checks for signatures in these headers (in order):
- `X-Webhook-Signature`
- `X-Kajabi-Signature`
- `X-Signature`
- `X-Hub-Signature-256`

If Kajabi uses a different header name, we can add it to the `extractSignatureFromHeaders()` function.

## Security Notes

- **Without verification:** Anyone who knows your webhook URL can send fake purchase events
- **With verification:** Only requests with valid signatures are processed
- **Best practice:** Always use verification in production, even if it means generating your own secret and configuring it in Kajabi

