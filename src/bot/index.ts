// src/bot/index.ts

import 'dotenv/config';
import { Client, GatewayIntentBits, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { supabase } from './supabaseClient.js';
import { CONFIG, getSupportContactString } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { applyCommandRateLimit } from '../utils/commandRateLimit.js';
import { handleCommandError } from '../utils/commandErrorHandler.js';
import { generateRequestId, withRequestIdAsync } from '../utils/requestId.js';

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
type CommandModule = {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const commands: Map<string, CommandModule> = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const fileUrl = pathToFileURL(filePath).href;
  const command = await import(fileUrl);
  if (command.data && command.execute) {
    commands.set(command.data.name, command);
    logger.info('Loaded command', { commandName: command.data.name });
  }
}

// --------------------
// Bot ready event (forward-compatible with discord.js v15)
// --------------------
const onReady = () => {
  logger.info('Discord bot logged in', {
    botTag: client.user?.tag,
    botId: client.user?.id,
    guildCount: client.guilds.cache.size,
  });
};
client.once('ready', onReady);
// v15+ emits 'clientReady' instead of 'ready'
// Register both to be forward-compatible
// @ts-ignore - 'clientReady' may exist in future Discord.js versions
if ('clientReady' in client) {
  client.once('clientReady' as never, onReady);
}

// Prevent crashes on Discord client errors
client.on('error', (err) => {
  logger.error('Discord client error', err);
});
client.on('shardError', (err) => {
  logger.error('Discord shard error', err);
});

// --------------------
// Interaction handler with rate limiting
// --------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // Generate request ID for this command execution
  const requestId = generateRequestId();
  
  // Execute command within request ID context for trace logging
  await withRequestIdAsync(requestId, async () => {
    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.warn('Command not found', { 
        commandName: interaction.commandName, 
        userId: interaction.user.id,
        requestId,
      });
      return;
    }

    logger.debug('Command execution started', {
      commandName: interaction.commandName,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      requestId,
    });

    // Apply rate limiting before executing command
    const rateLimitAllowed = await applyCommandRateLimit(interaction as ChatInputCommandInteraction);
    if (!rateLimitAllowed) {
      logger.debug('Command rate limited', {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        requestId,
      });
      return; // Rate limit message already sent
    }

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
      logger.debug('Command execution completed', {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        requestId,
      });
    } catch (err) {
      // Use standardized error handler
      await handleCommandError(
        err,
        interaction as ChatInputCommandInteraction,
        {
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          requestId,
        }
      );
    }
  });
});

// --------------------
// Guild member add handler
// --------------------
client.on('guildMemberAdd', async member => {
  logger.info('New member joined guild', {
    userId: member.user.id,
    username: member.user.username,
    guildId: member.guild.id,
  });

  try {
    // Check if this user has a pending join (from Kajabi purchase)
    const { data: pendingJoin, error } = await supabase
      .from('pending_joins')
      .select('*')
      .eq('discord_user_id', member.user.id)
      .is('joined_at', null)
      .single();

    if (error || !pendingJoin) {
      logger.debug('No pending join found for new member', { userId: member.user.id });
      return;
    }

    // Find the "1-on-1 Mentee" role
    const role = member.guild.roles.cache.find(r => r.name === '1-on-1 Mentee');

    if (!role) {
      logger.error('Could not find "1-on-1 Mentee" role', undefined, { guildId: member.guild.id });
      return;
    }

    // Assign the role
    await member.roles.add(role);
    logger.info('Assigned mentee role to new member', {
      userId: member.user.id,
      roleId: role.id,
      pendingJoinId: pendingJoin.id,
    });

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

    // Welcome message (fire-and-forget)
    try {
      const instructorMention = instructorInfo?.discord_id ? `<@${instructorInfo.discord_id}>` : instructorInfo?.name || 'your instructor';
      await member.send(
        `Welcome to the ${CONFIG.ORGANIZATION_NAME} Community! 🎉\n\n` +
        `You've been assigned the "1-on-1 Mentee" role -- this is needed so you can access the mentorship voice channels!\n\n` +
        `Your instructor is ${instructorMention}\n\n` +
        `Please inform them of your schedule so they can check their availability -- please include your time zone, as all our instructors and students are all over the world!\n\n` +
        `Having any issues? ${getSupportContactString()}`
      );
      logger.debug('Welcome DM sent to new member', { userId: member.user.id });
    } catch (dmError) {
      logger.warn('Could not send welcome DM to new member', {
        error: dmError instanceof Error ? dmError.message : String(dmError),
        userId: member.user.id,
      });
    }

  } catch (error) {
    logger.error('Error handling new member', error instanceof Error ? error : new Error(String(error)), {
      userId: member.user.id,
      guildId: member.guild.id,
    });
  }
});

// --------------------
// Log in to Discord
// --------------------
if (!process.env.DISCORD_BOT_TOKEN) {
  logger.error('DISCORD_BOT_TOKEN not set', undefined);
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);

// --------------------
// Graceful shutdown
// --------------------
async function shutdown(signal: string) {
  logger.info(`${signal} received. Shutting down Discord bot gracefully...`);
  try {
    await client.destroy();
    logger.info('Discord bot destroyed successfully');
  } catch (err) {
    logger.error('Error destroying Discord client', err instanceof Error ? err : new Error(String(err)));
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));