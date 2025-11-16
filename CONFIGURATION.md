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

### Server Configuration
```env
WEBHOOK_PORT=3000
NODE_ENV=production

# URL Shortener hardening
# Max redirects per IP per 15 minutes (default: 200)
REDIRECT_RATE_LIMIT_MAX=200
# Delete analytics older than this many days (default: 180)
ANALYTICS_RETENTION_DAYS=180
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
- New student mentorships
- Returning student renewals
- Manual student linking

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

You can enable branded short links for analytics tracking.

```env
# Optional: Use a custom domain for short links (recommended)
SHORT_URL_BASE=https://links.yourdomain.com

# If not set, the bot falls back to:
# https://${FLY_APP_NAME}.fly.dev
FLY_APP_NAME=huckleberry-bot
```

Set `SHORT_URL_BASE` to a subdomain you control (e.g., `links.huckleberry.art`) pointing to your Fly.io app. If you don’t set it, links will use your Fly.io app domain automatically.

