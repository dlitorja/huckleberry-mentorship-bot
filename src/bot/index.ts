// src/bot/index.ts

import 'dotenv/config';
import { Client, GatewayIntentBits, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { supabase } from './supabaseClient.js';
import { CONFIG, getSupportContactString } from '../config/constants.js';

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
    GatewayIntentBits.GuildMembers,
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
// Bot ready event (forward-compatible with discord.js v15)
// --------------------
const onReady = () => {
  console.log(`Logged in as ${client.user?.tag}!`);
};
client.once('ready', onReady);
// v15+ emits 'clientReady' instead of 'ready'
// Register both to be forward-compatible
// @ts-expect-error - 'clientReady' will exist in v15
client.once('clientReady', onReady);

// Prevent crashes on Discord client errors
client.on('error', (err) => {
  console.error('Discord client error:', err);
});
client.on('shardError', (err) => {
  console.error('Discord shard error:', err);
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
    // Gracefully handle cases where the interaction is no longer valid
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('An error occurred while handling your command.');
      } else if (interaction.isRepliable()) {
        await interaction.reply({ content: 'An error occurred while handling your command.', flags: MessageFlags.Ephemeral });
      }
    } catch {
      // Ignore follow-up errors like Unknown interaction (10062) or already acknowledged (40060)
    }
  }
});

// --------------------
// Guild member add handler
// --------------------
client.on('guildMemberAdd', async member => {
  console.log(`New member joined: ${member.user.tag} (${member.user.id})`);

  try {
    // Check if this user has a pending join (from Kajabi purchase)
    const { data: pendingJoin, error } = await supabase
      .from('pending_joins')
      .select('*')
      .eq('discord_user_id', member.user.id)
      .is('joined_at', null)
      .single();

    if (error || !pendingJoin) {
      console.log(`No pending join found for ${member.user.tag}`);
      return;
    }

    // Find the "1-on-1 Mentee" role
    const role = member.guild.roles.cache.find(r => r.name === '1-on-1 Mentee');

    if (!role) {
      console.error('Could not find "1-on-1 Mentee" role');
      return;
    }

    // Assign the role
    await member.roles.add(role);
    console.log(`Assigned "1-on-1 Mentee" role to ${member.user.tag}`);

    // Update pending join to mark as completed
    await supabase
      .from('pending_joins')
      .update({ joined_at: new Date().toISOString() })
      .eq('id', pendingJoin.id);

    // Get instructor info for personalized message
    const { data: instructorInfo } = await supabase
      .from('instructors')
      .select('discord_id, name')
      .eq('id', pendingJoin.instructor_id)
      .single();

    // Welcome message
    try {
      const instructorMention = instructorInfo?.discord_id ? `<@${instructorInfo.discord_id}>` : instructorInfo?.name || 'your instructor';
      await member.send(
        `Welcome to the ${CONFIG.ORGANIZATION_NAME} Community! 🎉\n\n` +
        `You've been assigned the "1-on-1 Mentee" role -- this is needed so you can access the mentorship voice channels!\n\n` +
        `Your instructor is ${instructorMention}\n\n` +
        `Please inform them of your schedule so they can check their availability -- please include your time zone, as all our instructors and students are all over the world!\n\n` +
        `Having any issues? ${getSupportContactString()}`
      );
    } catch (dmError) {
      console.log(`Could not DM ${member.user.tag}:`, dmError);
    }

  } catch (error) {
    console.error('Error handling new member:', error);
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

// --------------------
// Graceful shutdown
// --------------------
async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down Discord bot gracefully...`);
  try {
    await client.destroy();
  } catch (err) {
    console.error('Error destroying Discord client:', err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));