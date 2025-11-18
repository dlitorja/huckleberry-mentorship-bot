# Kajabi Integration Setup Guide

This guide will help you set up the Kajabi webhook integration for automated Discord invites.

## Prerequisites

1. Kajabi account with webhook access
2. Resend account (free tier: 3,000 emails/month)
3. Discord bot with appropriate permissions
4. Supabase database

## Step 1: Get Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys section
3. Create a new API key
4. Copy the key (starts with `re_`)

## Step 2: Verify Your Domain in Resend

1. In Resend dashboard, go to Domains
2. Add your domain (e.g., `yourdomain.com`)
3. Add the DNS records shown to your domain provider
4. Wait for verification (usually a few minutes)

## Step 3: Get Discord OAuth Credentials

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to **OAuth2** section
4. Copy your **Client Secret** (different from bot token!)
5. Add redirect URI: `http://your-server-url:3000/oauth/callback`
   - For local testing: `http://localhost:3000/oauth/callback`
   - For production: `https://yourdomain.com/oauth/callback`

## Step 4: Enable Required Bot Permissions

In Discord Developer Portal:
1. Go to **Bot** section
2. Enable these **Privileged Gateway Intents**:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
3. Go to **OAuth2 → URL Generator**
4. Select scopes:
   - `bot`
   - `applications.commands`
5. Select bot permissions:
   - `Manage Roles`
   - `Send Messages`

## Step 5: Update Environment Variables

Add these to your `.env` file:

```env
# Existing variables
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_GUILD_ID=your_guild_id
DISCORD_ADMIN_ID=your_discord_user_id
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# New variables for Kajabi integration
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
DISCORD_REDIRECT_URI=http://localhost:3000/oauth/callback
WEBHOOK_PORT=3000
```

## Step 6: Set Up Database Tables

Run the SQL schema in Supabase:

```sql
-- See database/schema.sql for the full schema
```

Or manually in Supabase SQL Editor:
1. Go to SQL Editor in Supabase
2. Copy contents of `database/schema.sql`
3. Run the query

## Step 7: Map Kajabi Offers to Instructors

Insert your offer mappings in Supabase:

```sql
-- Example: Map Kajabi offer IDs to instructors
INSERT INTO kajabi_offers (offer_id, offer_name, instructor_id)
VALUES 
  ('kajabi_offer_123', 'John Doe Mentorship', 'uuid-of-john-instructor'),
  ('kajabi_offer_456', 'Jane Smith Mentorship', 'uuid-of-jane-instructor');
```

To get your Kajabi offer IDs:
1. Go to Kajabi → Products → Your Product
2. Look at the URL or product details for the offer ID
3. Or check the webhook payload (see Step 9)

## Step 8: Run the Servers

You need to run TWO processes:

**Terminal 1 - Discord Bot:**
```bash
npm start
```

**Terminal 2 - Webhook Server:**
```bash
npm run webhook
```

The webhook server will run on port 3000 by default.

## Step 9: Set Up Kajabi Webhook

1. In Kajabi, go to **Settings → Integrations → Webhooks**
2. Click **Add Webhook**
3. Configure:
   - **Event**: Purchase completed (or similar)
   - **URL**: `http://your-server-url:3000/webhook/kajabi`
   - **Method**: POST
4. Save the webhook

### Testing the Webhook

Test with a tool like Postman:

```bash
POST http://localhost:3000/webhook/kajabi
Content-Type: application/json

{
  "email": "test@example.com",
  "offer_id": "kajabi_offer_123"
}
```

## Step 10: Deploy to Production

For production, you'll need to:

1. **Deploy the webhook server** to a hosting service:
   - Railway
   - Render
   - Heroku
   - Your own VPS

2. **Update environment variables** with production values

3. **Update Kajabi webhook URL** to your production URL

4. **Update Discord OAuth redirect URI** in:
   - Discord Developer Portal
   - Your `.env` file

## Troubleshooting

### Webhook not receiving requests
- Check firewall settings
- Verify Kajabi webhook URL is correct
- Check server logs: `npm run webhook`

### Email not sending
- Verify Resend API key is correct
- Check domain is verified in Resend
- Check Resend dashboard for delivery logs

### Role not being assigned
- Verify "1-on-1 Mentee" role exists in Discord
- Check bot has "Manage Roles" permission
- Bot's role must be ABOVE the "1-on-1 Mentee" role in the role hierarchy
- Check bot logs for errors

### OAuth callback not working
- Verify `DISCORD_CLIENT_SECRET` is set
- Check redirect URI matches in Discord Developer Portal
- Ensure webhook server is running

## Workflow Overview

1. 📦 Customer purchases on Kajabi
2. 🔔 Kajabi sends webhook to your server
3. 💾 Server stores pending join in database
4. 📧 Server sends email with OAuth invite link via Resend
5. 🔗 Customer clicks link → Discord OAuth flow
6. ✅ Customer joins server via OAuth
7. 🤖 Bot detects join → assigns "1-on-1 Mentee" role
8. 🎉 Customer receives welcome message

## Support

If you encounter issues:
1. Check server logs (`npm run webhook`)
2. Check bot logs (`npm start`)
3. Check Supabase logs
4. Check Resend delivery logs
5. Verify all environment variables are set correctly

