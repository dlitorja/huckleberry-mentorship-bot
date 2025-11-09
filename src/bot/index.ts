// src/bot/index.ts

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
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
// Event: bot is ready
// --------------------
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

// --------------------
// Event: interactionCreate
// --------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  console.log('Interaction received:', interaction.commandName);

  try {
    // Defer reply immediately to avoid timeout
    await interaction.deferReply({ ephemeral: true });

    if (interaction.commandName === 'session') {
      const student = interaction.options.getUser('student', true);
      console.log('Student option:', student);
      const instructorId = interaction.user.id;

      const { data, error } = await supabase
        .from('mentorships')
        .select('id, remaining_sessions')
        .eq('student_discord_id', student.id)
        .eq('instructor_discord_id', instructorId)
        .single();

      if (error) {
        console.error('Supabase error:', error);
      }

      if (error || !data) {
        await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
        return;
      }

      const newCount = Math.max(0, data.remaining_sessions - 1);
      const { error: updateError } = await supabase
        .from('mentorships')
        .update({ remaining_sessions: newCount })
        .eq('id', data.id);

      if (updateError) {
        console.error('Supabase error:', updateError);
        await interaction.editReply(`Failed to update ${student.tag}.`);
        return;
      }

      await interaction.editReply(`${student.tag} updated. Remaining sessions: ${newCount}.`);
    }
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
