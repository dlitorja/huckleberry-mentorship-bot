// src/bot/index.ts

import 'dotenv/config';
import { Client, GatewayIntentBits, Interaction } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

// -----------------
// Initialize Discord client
// -----------------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// -----------------
// Initialize Supabase client
// -----------------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// -----------------
// Bot ready event
// -----------------
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

// -----------------
// Handle slash commands
// -----------------
client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'decrement') {
    const user = interaction.options.getUser('student', true);

    // Defer reply immediately to avoid timeout
    await interaction.deferReply({ ephemeral: true });

    try {
      // Fetch mentorship data from Supabase
      const { data, error } = await supabase
        .from('mentorships')
        .select('*')
        .eq('discord_id', user.id)
        .single();

      if (error || !data) {
        await interaction.editReply({ content: `Student not found in the database.` });
        return;
      }

      const remaining = data.remaining_sessions - 1;

      // Update Supabase
      await supabase
        .from('mentorships')
        .update({ remaining_sessions: remaining })
        .eq('discord_id', user.id);

      // DM student if 1 session left
      if (remaining === 1) {
        try {
          await user.send(
            `You have 1 remaining mentorship session. Please notify your instructor if you wish to continue or cancel your subscription.`
          );
        } catch (err) {
          console.warn('Could not DM user:', err);
        }
      }

      // Edit deferred reply with updated count
      await interaction.editReply({
        content: `${user.username} now has ${remaining} session(s) remaining.`
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: `An error occurred while updating sessions.` });
    }
  }
});

// -----------------
// Login the bot
// -----------------
console.log('Bot token length:', process.env.DISCORD_BOT_TOKEN?.length);
client.login(process.env.DISCORD_BOT_TOKEN);
