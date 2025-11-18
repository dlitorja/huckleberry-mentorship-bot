# 🚀 Fly.io Quick Start Guide

## TL;DR - Deploy in 5 Minutes

### 1. Install Fly CLI
**Windows:**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Mac/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Login
```bash
fly auth login
```

### 3. Create App (Don't Deploy Yet)
```bash
fly launch --no-deploy
```
- Choose your app name (remember it!)
- Choose region closest to you
- Say **NO** to deploying now

### 4. Set Secrets

**⚠️ IMPORTANT:** Replace values with your actual credentials!

```bash
fly secrets set \
  DISCORD_BOT_TOKEN="your_bot_token" \
  DISCORD_CLIENT_ID="your_client_id" \
  DISCORD_CLIENT_SECRET="your_client_secret" \
  DISCORD_GUILD_ID="your_guild_id" \
  DISCORD_ADMIN_ID="your_discord_user_id" \
  SUPABASE_URL="your_supabase_url" \
  SUPABASE_SERVICE_ROLE_KEY="your_service_key" \
  RESEND_API_KEY="your_resend_key" \
  RESEND_FROM_EMAIL="noreply@yourdomain.com" \
  DISCORD_REDIRECT_URI="https://YOUR-APP-NAME.fly.dev/oauth/callback" \
  ORGANIZATION_NAME="Your Organization Name" \
  SUPPORT_EMAIL="support@yourdomain.com" \
  SUPPORT_DISCORD_ID="your_support_user_id" \
  SUPPORT_DISCORD_NAME="Your Name" \
  ADMIN_EMAIL="admin@yourdomain.com" \
  DEFAULT_SESSIONS_PER_PURCHASE="4"
```

**⚠️ Replace `YOUR-APP-NAME` with your actual Fly.io app name!**

**See [CONFIGURATION.md](./CONFIGURATION.md) for detailed explanation of each variable.**

### 5. Update Discord OAuth Settings
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your app → OAuth2 → General
3. Add to Redirects: `https://YOUR-APP-NAME.fly.dev/oauth/callback`

### 6. Deploy!
```bash
fly deploy
```

### 7. Check Logs
```bash
fly logs
```

Look for:
- ✅ `Logged in as YourBot#1234!`
- ✅ `Webhook server running on port 3000`

### 8. Register Discord Commands
```bash
npm run register
```

## ✅ Done!

Your bot is now running 24/7 on Fly.io (for free)!

**Your webhook URL:** `https://YOUR-APP-NAME.fly.dev/webhook/kajabi`  
**Your OAuth URL:** `https://YOUR-APP-NAME.fly.dev/oauth/callback`

---

## 📋 Quick Commands Reference

```bash
# View logs
fly logs

# Check status
fly status

# Open dashboard
fly dashboard

# Restart app
fly apps restart

# SSH into app
fly ssh console

# Update after code changes
fly deploy
```

---

## 🐛 Troubleshooting

**Bot not connecting?**
```bash
fly logs
fly secrets list  # Check if all secrets are set
```

**Need to update a secret?**
```bash
fly secrets set SECRET_NAME="new_value"
```

**Want to unset a secret?**
```bash
fly secrets unset SECRET_NAME
```

---

## 💰 Pricing

**Free tier includes:**
- 3 shared VMs (256MB RAM each)
- 160GB bandwidth/month
- This bot should stay **100% free**

---

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed docs and alternative platforms.

