# Huckleberry Mentorship Bot

A comprehensive Discord bot and webhook system for managing 1-on-1 mentorship programs. Automatically onboards students, tracks sessions, sends notifications, and provides instructors with powerful tools to manage their mentees.

## Features

### 🎯 Core Features
- **Automated Onboarding**: Kajabi webhook integration automatically processes purchases and sends Discord invite emails
- **OAuth Flow**: Seamless Discord OAuth authentication assigns roles and creates mentorship records
- **Session Management**: Track sessions with date tracking, notes, and resource links
- **Recurring Students**: Automatically handles returning students with session banking
- **Student Removal**: Automatic role removal on cancellations/refunds via Kajabi webhooks, plus manual admin control
- **URL Shortener & Analytics**: Create branded short links with detailed click tracking and analytics.

### 💬 Discord Commands
- **Instructor Commands**: `/session`, `/addsessions`, `/liststudents`, `/sessionsummary`, `/addnote`, `/viewnotes`, `/addlink`, `/shortenurl`, `/urlstats`, `/urllist`, `/urldelete`
- **Admin Commands**: `/adminsummary`, `/linkstudent`, `/removestudent`
- **Session Notes**: Add text notes and resource links to track mentorship progress

### 📧 Communication
- **Email Integration**: Resend API for onboarding emails and admin notifications
- **Discord DMs**: Automated welcome messages and renewal notifications
- **Support Contact**: Centralized support information in all communications

### 🔒 Security & Monitoring
- **Environment-based Configuration**: All sensitive data in environment variables
- **Uptime Monitoring**: UptimeRobot integration with health check endpoint
- **Error Tracking**: Comprehensive admin alerts for webhook, database, and email errors

## Prerequisites

- **Node.js** (v16 or higher)
- **Discord Bot** with OAuth2 enabled
- **Supabase** account and project
- **Resend** account for email sending
- **Kajabi** site (optional, for automated onboarding)
- **Fly.io** account (for production deployment)

## Quick Start

For detailed setup instructions, see:
- **[CONFIGURATION.md](CONFIGURATION.md)** - Complete environment variable guide
- **[FLY_QUICKSTART.md](FLY_QUICKSTART.md)** - Deploy to Fly.io in minutes
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Comprehensive deployment guide
- **[COMMANDS_SUMMARY.md](COMMANDS_SUMMARY.md)** - All Discord commands reference
- **[ADMIN_FEATURES.md](ADMIN_FEATURES.md)** - Admin notification system details
- **[STUDENT_REMOVAL.md](STUDENT_REMOVAL.md)** - Automatic & manual student removal guide

### Local Development

1. **Clone the repository:**
```bash
git clone https://github.com/dlitorja/huckleberry-mentorship-bot.git
cd huckleberry-mentorship-bot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env` (if available) or create `.env`
   - See [CONFIGURATION.md](CONFIGURATION.md) for all required variables

4. **Set up database:**
   - Run the SQL files in `database/` in your Supabase SQL editor
   - See Database Setup section below

5. **Register Discord commands:**
```bash
npm run register-commands
```

6. **Start both bot and webhook server:**
```bash
npm run start:all
```

## Configuration

Create a `.env` file in the root directory. See **[CONFIGURATION.md](CONFIGURATION.md)** for the complete list of required and optional environment variables.

**Minimal `.env` example:**
```env
# Discord
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_GUILD_ID=your_guild_id
DISCORD_REDIRECT_URI=https://your-domain.fly.dev/oauth/callback

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Resend Email
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=admin@yourdomain.com

# Admin & Organization
ADMIN_EMAIL=admin@yourdomain.com
DISCORD_ADMIN_ID=your_discord_user_id
ORGANIZATION_NAME=Your Organization Name
SUPPORT_EMAIL=support@yourdomain.com
```

**Important Links:**
- [Discord Developer Portal](https://discord.com/developers/applications) - Get bot credentials
- [Supabase Dashboard](https://supabase.com) - Get database credentials
- [Resend Dashboard](https://resend.com) - Get email API key

## Database Setup

The bot uses multiple Supabase tables. Run the SQL files in the `database/` directory in order:

1. **`database/schema.sql`** - Core tables (instructors, mentees, mentorships, pending_joins, kajabi_offers)
2. **`database/add_session_tracking.sql`** - Adds `last_session_date` column
3. **`database/add_session_notes.sql`** - Adds session_notes and session_links tables
4. **`database/add_mentorship_status.sql`** - Adds status tracking for ended mentorships
5. **`database/add_url_shortener.sql`** - Adds tables for the URL shortener.
6. **`database/insert_kajabi_offers.sql`** - Populate your Kajabi offer mappings

**Key Tables:**
- `instructors` - Instructor profiles with Discord IDs
- `mentees` - Student profiles with email and Discord ID
- `mentorships` - Links students to instructors with session counts
- `kajabi_offers` - Maps Kajabi offer IDs to instructors
- `pending_joins` - Tracks purchases awaiting Discord onboarding
- `session_notes` - Session notes with timestamps
- `session_links` - Resource links attached to sessions
- `shortened_urls` - Stores short links and metadata
- `url_analytics` - Tracks click data for each short link

See `database/schema.sql` for complete schema details.

## Commands

For complete command documentation, see **[COMMANDS_SUMMARY.md](COMMANDS_SUMMARY.md)**.

### Instructor Commands

- **`/session`** - Decrement a student's sessions and optionally set session date
- **`/addsessions`** - Add multiple sessions to a student's account
- **`/liststudents`** - View all your students with session counts and last session dates
- **`/sessionsummary`** - Check a specific student's session details
- **`/addnote`** - Add a text note to a session for a student
- **`/viewnotes`** - View all session notes and links for a student
- **`/addlink`** - Add a resource link to a session note
- **`/shortenurl`** - Create a short URL with analytics
- **`/urlstats`** - View analytics for a short URL
- **`/urllist`** - List all your short URLs
- **`/urldelete`** - Delete a short URL

### Admin Commands

- **`/adminsummary`** - View all mentorships across all instructors (admin only)
- **`/linkstudent`** - Manually link a student's email to their Discord account (admin only)
- **`/removestudent`** - Remove a student's 1-on-1 Mentee role (admin only)

### Example Usage

```
/session student:@JohnDoe date:2025-01-15
/addsessions student:@JaneDoe amount:4
/addnote student:@JohnDoe note:Discussed composition principles
/shortenurl url:https://my-long-url.com/with/a/very/long/path code:promo1
/removestudent student:@CompletedStudent reason:"Graduated from program"
```

## Project Structure

```
huckleberry-mentorship-bot/
├── src/
│   ├── bot/
│   │   ├── commands/           # All Discord slash commands
│   │   │   ├── session.ts
│   │   │   ├── addsessions.ts
│   │   │   ├── liststudents.ts
│   │   │   ├── sessionsummary.ts
│   │   │   ├── adminsummary.ts
│   │   │   ├── linkstudent.ts
│   │   │   ├── addnote.ts
│   │   │   ├── viewnotes.ts
│   │   │   └── addlink.ts
│   │   ├── index.ts            # Main Discord bot
│   │   ├── registerCommands.ts # Command registration
│   │   └── supabaseClient.ts   # Database client
│   ├── server/
│   │   ├── webhookServer.ts    # Kajabi webhook handler
│   │   └── oauthCallback.ts    # Discord OAuth flow
│   ├── utils/
│   │   └── adminNotifications.ts # Admin alert system
│   ├── config/
│   │   └── constants.ts        # Org-specific config
│   └── start.ts                # Starts both bot & server
├── database/                   # SQL migration files
├── .env                        # Environment variables (not committed)
├── Dockerfile                  # Container configuration
├── fly.toml                    # Fly.io deployment config
├── package.json                # Dependencies & scripts
└── README.md                   # This file
```

## Technologies Used

- **[Discord.js](https://discord.js.org/)** v14 - Discord bot framework
- **[Supabase](https://supabase.com)** - PostgreSQL database and authentication
- **[Resend](https://resend.com)** - Transactional email API
- **[Express](https://expressjs.com/)** - Web server for webhooks and OAuth
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Fly.io](https://fly.io)** - Cloud deployment platform
- **[UptimeRobot](https://uptimerobot.com)** - Uptime monitoring

## Development

### Running Locally

**Bot only:**
```bash
npm run dev:bot
```

**Webhook server only:**
```bash
npm run dev:server
```

**Both together:**
```bash
npm run start:all
```

### Registering Commands

After creating or modifying commands:
```bash
npm run register-commands
```

### Adding New Commands

1. Create a new file in `src/bot/commands/yourcommand.ts`
2. Export `data` (SlashCommandBuilder) and `execute` function
3. The bot automatically loads all commands from the commands folder
4. Run `npm run register-commands` to register with Discord

Example:
```typescript
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('mycommand')
  .setDescription('My command description');

export async function execute(interaction: CommandInteraction) {
  await interaction.reply('Hello!');
}
```

## Deployment

### Production Deployment (Fly.io)

See **[FLY_QUICKSTART.md](FLY_QUICKSTART.md)** for step-by-step deployment guide.

**Quick deploy:**
```bash
fly deploy
```

**View logs:**
```bash
fly logs
```

**Set environment secrets:**
```bash
fly secrets set DISCORD_BOT_TOKEN=your_token
```

## Monitoring & Maintenance

- **Health Check**: `https://your-app.fly.dev/health`
- **UptimeRobot**: Set up keyword monitoring on `/health` endpoint looking for "ok" (keyword NOT exists = alert)
- **Admin Alerts**: Automatic email/DM notifications for errors and purchases
- **Logs**: View with `fly logs` or in Fly.io dashboard

## How It Works

### Student Onboarding Flow

1. **Purchase** - Student buys 1-on-1 mentorship on Kajabi
2. **Webhook** - Kajabi sends webhook to your server at `/webhook/kajabi`
3. **Email** - System sends Discord invite email with OAuth link via Resend
4. **OAuth** - Student clicks link, authenticates with Discord
5. **Role Assignment** - Bot assigns "1-on-1 Mentee" role and creates mentorship record
6. **Welcome DM** - Bot sends welcome message with instructor info
7. **Admin Notification** - Admin receives email with purchase details

### Returning Student Flow

1. **Purchase** - Existing student repurchases
2. **Detection** - System recognizes email/Discord ID
3. **Session Update** - Adds sessions to existing account (allows banking)
4. **Notifications** - Student, instructor, and admin all receive renewal notifications

### Session Management

- Instructors use `/session` to mark sessions complete
- Session dates are tracked automatically
- Notes and links can be added with `/addnote` and `/addlink`
- Admins can view all mentorships with `/adminsummary`

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

Copyright 2025 Huckleberry Art Inc.

## Contributing

This is an open-source project! Contributions are welcome:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit with clear messages (`git commit -m 'Add amazing feature'`)
5. Push to your branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

**Areas for contribution:**
- Additional Discord commands
- Web interface for session management (planned)
- Integration with other course platforms
- Documentation improvements
- Bug fixes and optimizations

## Support & Community

- **Issues**: [GitHub Issues](https://github.com/dlitorja/huckleberry-mentorship-bot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/dlitorja/huckleberry-mentorship-bot/discussions)
- **Documentation**: See the various `.md` files in the repository

**Need help?** Open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)

---

Built with ❤️ for mentorship programs everywhere.
