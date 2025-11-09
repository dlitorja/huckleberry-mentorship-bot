// src/bot/index.ts

import 'dotenv/config';
import { Client, GatewayIntentBits, ChatInputCommandInteraction } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

// --------------------
// Supabase setup
// --------------------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
// Bot ready event
// --------------------
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

// --------------------
// Interaction handler
// --------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== 'session') return;

  try {
    // Defer reply immediately
    await interaction.deferReply({ ephemeral: true });

    const instructorDiscordId = interaction.user.id;
    const studentDiscordId = interaction.options.getUser('student', true).id;

    // Lookup UUIDs
    const { data: instructorData, error: instrError } = await supabase
      .from('instructors')
      .select('id')
      .eq('discord_id', instructorDiscordId)
      .single();

    const { data: studentData, error: studentError } = await supabase
      .from('mentees')
      .select('id')
      .eq('discord_id', studentDiscordId)
      .single();

    if (instrError || !instructorData) {
      console.error('Instructor lookup error:', instrError);
      await interaction.editReply('Instructor not found in database.');
      return;
    }

    if (studentError || !studentData) {
      console.error('Student lookup error:', studentError);
      await interaction.editReply('Student not found in database.');
      return;
    }

    // Fetch mentorship record(s)
    const { data: mentorship, error: mentorshipError } = await supabase
      .from('mentorships')
      .select('id, sessions_remaining, total_sessions')
      .eq('instructor_id', instructorData.id)
      .eq('mentee_id', studentData.id)
      .single();

    if (mentorshipError || !mentorship) {
      console.error('Supabase error fetching mentorship:', mentorshipError);
      await interaction.editReply(`No mentorship record found for ${interaction.options.getUser('student', true).tag}.`);
      return;
    }

    // Update remaining sessions
    const newCount = Math.max(0, mentorship.sessions_remaining - 1);
    const { error: updateError } = await supabase
      .from('mentorships')
      .update({ sessions_remaining: newCount })
      .eq('id', mentorship.id);

    if (updateError) {
      console.error('Supabase error updating mentorship:', updateError);
      await interaction.editReply(`Failed to update ${interaction.options.getUser('student', true).tag}.`);
      return;
    }

    let replyMsg = `${interaction.options.getUser('student', true).tag} updated. Remaining sessions: ${newCount}/${mentorship.total_sessions}.`;
    if (newCount === 0) replyMsg += ' ⚠️ No sessions remaining!';

    await interaction.editReply(replyMsg);

  } catch (err) {
    console.error('Interaction error:', err);
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
  console.error('Error: DISCORD_BOT_TOKEN is not set.');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);