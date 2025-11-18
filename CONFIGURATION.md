# Configuration Guide

This document explains all the configuration options for the Huckleberry Mentorship Bot.

## 🔧 Required Environment Variables

### Discord Configuration
```env
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id  
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_GUILD_ID=your_discord_server_id
DISCORD_ADMIN_ID=your_discord_user_id
DISCORD_REDIRECT_URI=https://your-app.fly.dev/oauth/callback
```

### Supabase Configuration
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Email Service (Resend)
```env
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
TESTIMONIAL_FORM_URL=https://forms.gle/YOUR_FORM_ID
```

### Video Calling (Agora.io) - Optional
```env
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

**Note:** These are only required for the video calling feature. To get Agora credentials:
1. Sign up at [https://www.agora.io/](https://www.agora.io/)
2. Create a new project
3. Copy your App ID and App Certificate from the project dashboard

### Server Configuration
```env
WEBHOOK_PORT=3000
NODE_ENV=production

# URL Shortener hardening
# Max redirects per IP per 15 minutes (default: 200)
REDIRECT_RATE_LIMIT_MAX=200
# Delete analytics older than this many days (default: 180)
ANALYTICS_RETENTION_DAYS=180

# Optional: base URL for short links (recommended for custom domain)
SHORT_URL_BASE=https://links.yourdomain.com

# Optional: used for Fly.io domain fallback in short links
FLY_APP_NAME=your-fly-app-name
```

---

## 🎨 Organization Customization

**IMPORTANT:** These variables customize the bot for your organization. Update them to match your branding and contact information.

### Organization Details
```env
# Your organization name (appears in welcome messages)
ORGANIZATION_NAME=Your Organization Name

# Support email shown to students
SUPPORT_EMAIL=support@yourdomain.com

# Discord user ID for support contact (appears in messages as @mention)
SUPPORT_DISCORD_ID=123456789012345678

# Name of support contact (e.g., "Admin", "Support Team")
SUPPORT_DISCORD_NAME=Admin

# Admin email where purchase notifications are sent
ADMIN_EMAIL=admin@yourdomain.com

# Number of sessions included per purchase (default: 4)
DEFAULT_SESSIONS_PER_PURCHASE=4
```

---

## 📋 How Values Are Used

### `ORGANIZATION_NAME`
**Appears in:**
- Student welcome emails
- Student Discord DMs
- All student-facing communications

**Example:** "Welcome to **Your Organization Name** Community!"

### `SUPPORT_EMAIL`
**Appears in:**
- Student emails (footer)
- Error pages
- Student Discord DMs

**Example:** "Questions? Contact us at **support@yourdomain.com**"

### `SUPPORT_DISCORD_ID` & `SUPPORT_DISCORD_NAME`
**Appears in:**
- Student Discord DMs

**Example:** "Having issues? Email us at support@example.com or send a DM to **Admin** (**@YourUsername**)"

### `ADMIN_EMAIL`
**Receives:**
- Purchase notifications
- Renewal notifications

### `DEFAULT_SESSIONS_PER_PURCHASE`
**Used for:**
- New student mentorships and renewals when `kajabi_offers.sessions_per_purchase` is NOT set for the purchased offer
- Manual student linking

**Per-offer override:**
- Set `sessions_per_purchase` in the `kajabi_offers` table to control bundle size per product (preferred).
- Falls back to `DEFAULT_SESSIONS_PER_PURCHASE` if not configured.

---

## 🚀 Setting Environment Variables

### For Local Development
Create a `.env` file in the project root with all variables above.

### For Fly.io Deployment
```bash
fly secrets set ORGANIZATION_NAME="Your Organization Name"
fly secrets set SUPPORT_EMAIL="support@yourdomain.com"
fly secrets set SUPPORT_DISCORD_ID="123456789012345678"
fly secrets set SUPPORT_DISCORD_NAME="Your Name"
fly secrets set ADMIN_EMAIL="admin@yourdomain.com"
fly secrets set DEFAULT_SESSIONS_PER_PURCHASE="4"
fly secrets set SHORT_URL_BASE="https://links.yourdomain.com" # optional
fly secrets set FLY_APP_NAME="your-fly-app-name"              # optional for short link fallback
```

### For Railway/Render/Other Platforms
Add these as environment variables in your platform's dashboard.

---

## ✅ Default Values

If you don't set these variables, the bot will use these defaults:

- `ORGANIZATION_NAME`: "Your Organization"
- `SUPPORT_EMAIL`: "support@example.com"
- `SUPPORT_DISCORD_ID`: "" (no Discord mention)
- `SUPPORT_DISCORD_NAME`: "Admin"
- `ADMIN_EMAIL`: "admin@example.com"
- `DEFAULT_SESSIONS_PER_PURCHASE`: 4

**⚠️ Make sure to set these in production!**

---

## 🎯 For Other Organizations

If you're deploying this bot for your own organization:

1. **Fork the repository**
2. **Update `.env` or set secrets** with your organization's values
3. **No code changes needed!** Everything is configurable via environment variables

---

## 📧 Example: Full Configuration

```env
# Example organization values
ORGANIZATION_NAME=My Mentorship Academy
SUPPORT_EMAIL=support@mydomain.com
SUPPORT_DISCORD_ID=123456789012345678
SUPPORT_DISCORD_NAME=Admin
ADMIN_EMAIL=admin@mydomain.com
DEFAULT_SESSIONS_PER_PURCHASE=4
```

---

## 🔄 Updating Configuration

After changing any environment variables:

**Local:**
- Restart the bot and webhook server

**Fly.io:**
```bash
fly secrets set VARIABLE_NAME="new_value"
# The app will automatically restart
```

---

## 🔐 Security Notes

- ✅ No sensitive data is hardcoded in the repository
- ✅ All secrets are in environment variables
- ✅ Organization details are configurable
- ✅ Safe to open-source or share the codebase

**Always use environment variables for:**
- API keys and tokens
- Email addresses
- Discord IDs
- Organization-specific information

---

## 🔗 URL Shortener Configuration

These variables control the behavior of the built-in URL shortener.

```env
# Optional: Use a custom domain for short links (e.g., https://links.yourdomain.com)
# If not set, the bot falls back to your Fly.io app domain: https://${FLY_APP_NAME}.fly.dev
SHORT_URL_BASE=

# Optional: Max redirects per IP per 15 minutes (default: 200)
# Helps prevent abuse and denial-of-service attacks on your redirector.
REDIRECT_RATE_LIMIT_MAX=200

# Optional: Delete analytics data older than this many days (default: 180)
# Keeps your database clean and respects user privacy by not storing data indefinitely.
ANALYTICS_RETENTION_DAYS=180
```

### `SHORT_URL_BASE`
- **Purpose:** Sets a custom, branded domain for your short links. This is highly recommended for a professional appearance.
- **Setup:** You must own the domain and point its DNS (usually a CNAME record) to your Fly.io app URL (e.g., `your-app-name.fly.dev`).
- **Default:** If left blank, links will be generated using your app's default Fly.io domain.

### `REDIRECT_RATE_LIMIT_MAX`
- **Purpose:** Protects your redirect endpoint from being spammed or abused.
- **Default:** `200`. A single user is unlikely to hit this limit during normal use.

### `ANALYTICS_RETENTION_DAYS`
- **Purpose:** Automatically purges old click-tracking data to keep your database size manageable and enhance privacy.
- **Default:** `180` (approximately 6 months).

