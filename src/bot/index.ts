// src/bot/index.ts

import 'dotenv/config';
import { Client, GatewayIntentBits, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { supabase } from './supabaseClient.js';

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
        `Welcome to the Huckleberry Art Community! 🎉\n\n` +
        `You've been assigned the "1-on-1 Mentee" role -- this is needed so you can access the mentorship voice channels!\n\n` +
        `Your instructor is ${instructorMention}\n\n` +
        `Please inform them of your schedule so they can check their availability -- please include your time zone, as all our instructors and students are all over the world!\n\n` +
        `Having any issues? Email us at huckleberryartinc@gmail.com or send a DM to Dustin (<@184416083984384005>)`
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