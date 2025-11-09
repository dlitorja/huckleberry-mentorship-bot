# Deployment Guide

This guide covers deploying the Huckleberry Mentorship Bot to various platforms.

## 🚀 Quick Start: Fly.io (Recommended Free Option)

### Prerequisites
- [Fly.io account](https://fly.io/app/sign-up) (free)
- [Fly CLI installed](https://fly.io/docs/hands-on/install-flyctl/)
- Git repository

### Step 1: Install Fly CLI

**Windows (PowerShell):**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Mac/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

### Step 2: Login to Fly.io

```bash
fly auth login
```

### Step 3: Launch Your App

From your project root:

```bash
fly launch
```

This will:
- Detect your `fly.toml` configuration
- Create a new app on Fly.io
- **Don't deploy yet** - we need to set environment variables first

When prompted:
- Choose your app name (or keep the suggested one)
- Choose your region (closest to you or your users)
- **Say NO to deploying now** (we need to set secrets first)

### Step 4: Set Environment Variables (Secrets)

Set all your environment variables as secrets:

```bash
fly secrets set DISCORD_BOT_TOKEN="your_bot_token"
fly secrets set DISCORD_CLIENT_ID="your_client_id"
fly secrets set DISCORD_CLIENT_SECRET="your_client_secret"
fly secrets set DISCORD_GUILD_ID="your_guild_id"
fly secrets set DISCORD_ADMIN_ID="your_admin_discord_id"
fly secrets set SUPABASE_URL="your_supabase_url"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your_service_key"
fly secrets set RESEND_API_KEY="your_resend_key"
fly secrets set RESEND_FROM_EMAIL="noreply@yourdomain.com"
fly secrets set DISCORD_REDIRECT_URI="https://your-app-name.fly.dev/oauth/callback"
```

**Important:** Replace `your-app-name` in the `DISCORD_REDIRECT_URI` with your actual Fly.io app name.

### Step 5: Update Discord OAuth Redirect URI

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to **OAuth2** → **General**
4. Add your Fly.io callback URL to **Redirects**:
   ```
   https://your-app-name.fly.dev/oauth/callback
   ```

### Step 6: Deploy!

```bash
fly deploy
```

### Step 7: Check Logs

```bash
fly logs
```

You should see:
```
✅ Logged in as YourBotName#1234!
🌐 Webhook server running on port 3000
```

### Step 8: Register Discord Commands

You'll need to register slash commands. You can do this from your local machine:

```bash
npm run register
```

Or SSH into your Fly.io app:

```bash
fly ssh console
npm run register
exit
```

---

## 🔄 Updating Your Deployment

After making code changes:

```bash
git add .
git commit -m "Your changes"
git push
fly deploy
```

---

## 📊 Monitoring

### View logs
```bash
fly logs
```

### Check app status
```bash
fly status
```

### View dashboard
```bash
fly dashboard
```

---

## 🌐 Alternative Platforms

The same Docker setup works on other platforms:

### Railway

1. Sign up at [railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Add environment variables in the Variables tab
4. Railway will auto-detect `Dockerfile` and deploy

### Render

1. Sign up at [render.com](https://render.com)
2. Create new Web Service from GitHub repo
3. Choose "Docker" as environment
4. Add environment variables
5. Deploy

### Heroku

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set env vars: `heroku config:set KEY=value`
5. Deploy: `git push heroku main`

---

## 🔧 Local Development

### Run bot only:
```bash
npm start
```

### Run webhook server only:
```bash
npm run webhook
```

### Run both (for testing):
```bash
npm run start:all
```

---

## 🐛 Troubleshooting

### Bot not responding to commands
- Check logs: `fly logs`
- Verify bot token is correct: `fly secrets list`
- Ensure commands are registered: `npm run register`
- Check bot has proper permissions in Discord

### Webhook not receiving requests
- Verify webhook URL in Kajabi matches your Fly.io URL
- Check logs for incoming requests: `fly logs`
- Test health endpoint: `https://your-app-name.fly.dev/health`

### OAuth callback not working
- Verify redirect URI matches in Discord Developer Portal
- Check `DISCORD_CLIENT_SECRET` is set correctly
- Ensure `DISCORD_REDIRECT_URI` points to your Fly.io URL

### App keeps restarting
- Check logs for errors: `fly logs`
- Verify all required env variables are set: `fly secrets list`
- Check database connection (Supabase)

### Out of memory
- Fly.io free tier has 256MB RAM
- Scale up if needed: `fly scale memory 512`

---

## 💰 Cost Estimates

### Fly.io Free Tier
- Up to 3 shared-cpu VMs (256MB RAM each)
- 160GB bandwidth per month
- **Perfect for this bot** - should stay free

### If you need to scale:
- 512MB RAM: ~$2/month
- 1GB RAM: ~$4/month

---

## 🔐 Security Best Practices

1. ✅ Never commit `.env` file
2. ✅ Use secrets/environment variables for all credentials
3. ✅ Rotate tokens periodically
4. ✅ Use HTTPS for webhook endpoints (automatic on Fly.io)
5. ✅ Limit Discord bot permissions to minimum required

---

## 📞 Support

- **Fly.io Docs**: https://fly.io/docs/
- **Discord.js Guide**: https://discordjs.guide/
- **Supabase Docs**: https://supabase.com/docs

---

## 🎉 You're All Set!

Your bot should now be running 24/7 on Fly.io. The webhook server will handle Kajabi purchases and the Discord bot will manage roles and sessions.

**Test the setup:**
1. Send a test webhook to `/webhook/kajabi`
2. Try Discord commands: `/liststudents`, `/sessionsummary`
3. Test OAuth flow by clicking an invite link

