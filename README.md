# Huckleberry Mentorship Bot

A Discord bot for managing mentorship sessions between instructors and students. The bot tracks and updates remaining sessions for mentorship relationships.

## Features

- **Session Management**: Track and decrement remaining sessions for student-instructor pairs
- **Slash Commands**: Modern Discord slash command interface
- **Supabase Integration**: Stores mentorship data in Supabase database
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Discord Bot Token
- Supabase account and project
- TypeScript knowledge (optional, for development)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd huckleberry-mentorship-bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see Configuration section)

4. Register Discord commands:
```bash
ts-node src/bot/registerCommands.ts
```

5. Start the bot:
```bash
npm start
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_discord_guild_id

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Getting Discord Credentials

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token
5. Go to "OAuth2" > "General" to get the Client ID
6. Enable "Message Content Intent" in the Bot section
7. Invite the bot to your server with appropriate permissions

### Getting Supabase Credentials

1. Create a project at [Supabase](https://supabase.com)
2. Go to Project Settings > API
3. Copy the Project URL and Service Role Key

## Database Setup

The bot requires a `mentorships` table in your Supabase database with the following schema:

```sql
CREATE TABLE mentorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_discord_id TEXT NOT NULL,
  instructor_discord_id TEXT NOT NULL,
  remaining_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Commands

### `/session`

Update remaining sessions for a student.

**Options:**
- `student` (required): The student user to update

**Usage:**
```
/session student:@username
```

**Behavior:**
- Decrements the remaining sessions count by 1
- Finds the mentorship record matching the student and instructor (command user)
- Returns an error if no mentorship record is found
- Displays the updated remaining sessions count

## Project Structure

```
huckleberry-mentorship-bot/
├── src/
│   └── bot/
│       ├── commands/
│       │   └── session.ts      # Session command definition
│       ├── index.ts            # Main bot file
│       └── registerCommands.ts # Command registration script
├── .env                        # Environment variables (not committed)
├── .gitignore                  # Git ignore file
├── package.json                # Project dependencies
└── README.md                   # This file
```

## Development

### Running the Bot

```bash
npm start
```

### Registering Commands

After creating or modifying commands, register them with Discord:

```bash
ts-node src/bot/registerCommands.ts
```

### Adding New Commands

1. Create a new file in `src/bot/commands/`
2. Export a `data` property with a `SlashCommandBuilder` instance
3. Register the command by running `registerCommands.ts`
4. Add command handler logic in `src/bot/index.ts`

Example command file:
```typescript
import { SlashCommandBuilder } from '@discordjs/builders';

export const data = new SlashCommandBuilder()
  .setName('commandname')
  .setDescription('Command description');
```

## Technologies Used

- **Discord.js** v14 - Discord API library
- **Supabase** - Backend as a service (database)
- **TypeScript** - Type-safe JavaScript
- **Node.js** - Runtime environment

## Error Handling

The bot includes comprehensive error handling:
- Database errors are logged to the console
- User-friendly error messages are displayed to users
- Interactions are deferred to prevent timeouts
- All errors are caught and handled gracefully

## License

[Add your license here]

## Contributing

[Add contributing guidelines here]

## Support

[Add support information here]
