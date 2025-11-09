// src/bot/index.ts

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'session') {
    const student = interaction.options.getUser('student', true);
    const instructorId = interaction.user.id;

    // Fetch the mentorship record for this student–instructor pair
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
      await interaction.reply({
        content: `Could not find a mentorship record for ${student.tag} with you.`,
        ephemeral: true,
      });
      return;
    }

    // Decrement remaining sessions
    const newCount = Math.max(0, data.remaining_sessions - 1);
    const { error: updateError } = await supabase
      .from('mentorships')
      .update({ remaining_sessions: newCount })
      .eq('id', data.id);

    if (updateError) {
      console.error('Supabase error:', updateError);
    }

    if (newCount === 0) {
      await interaction.reply({
        content: `${student.tag} has no remaining sessions with you.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `Updated ${student.tag} for you. Remaining sessions: ${newCount}.`,
      ephemeral: false,
    });
  }
});

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('Error: DISCORD_BOT_TOKEN is not set.');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);
