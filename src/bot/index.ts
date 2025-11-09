// src/bot/index.ts

import 'dotenv/config';
import { Client, GatewayIntentBits, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------
// Discord client setup
// --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --------------------
// Load commands dynamically
// --------------------
const commands: Map<string, any> = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const fileUrl = pathToFileURL(filePath).href;
  const command = await import(fileUrl);
  if (command.data && command.execute) {
    commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  }
}

// --------------------
// Bot ready event
// --------------------
client.once('clientReady', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

// --------------------
// Interaction handler
// --------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.log(`Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (err) {
    console.error('Command execution error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('An error occurred while handling your command.');
    } else {
      await interaction.reply('An error occurred while handling your command.');
    }
  }
});

// --------------------
// Log in to Discord
// --------------------
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('DISCORD_BOT_TOKEN not set.');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);