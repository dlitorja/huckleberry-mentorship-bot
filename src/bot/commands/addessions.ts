// src/bot/commands/addsessions.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { getMentorshipByDiscordIds } from '../../utils/mentorship.js';
import { validatePositiveInteger } from '../../utils/validation.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';

export const data = new SlashCommandBuilder()
  .setName('addsessions')
  .setDescription('Add sessions to a student.')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student to add sessions for')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('Number of sessions to add (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  );

async function executeCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const student = interaction.options.getUser('student', true);
  const instructorDiscordId = interaction.user.id;
  const amountInput = interaction.options.getInteger('amount', true);

  // Validate amount
  const amount = validatePositiveInteger(amountInput, 'amount', 1, 100);

  // Optimized mentorship lookup with performance monitoring
  const mentorshipData = await measurePerformance(
    'addsessions.mentorship_lookup',
    async () => {
      const { data, error } = await getMentorshipByDiscordIds({
        instructorDiscordId,
        menteeDiscordId: student.id,
        status: 'active'
      });

      if (error || !data) {
        throw new Error(`Could not find a mentorship record for ${student.tag}`);
      }
      return data;
    },
    { instructorDiscordId, menteeDiscordId: student.id }
  );

  const newRemaining = mentorshipData.sessions_remaining + amount;
  const newTotal = Math.max(mentorshipData.total_sessions, newRemaining);

  // Update sessions with performance monitoring
  await measurePerformance(
    'addsessions.update_sessions',
    async () => {
      const { error: updateError } = await supabase
        .from('mentorships')
        .update({ sessions_remaining: newRemaining, total_sessions: newTotal })
        .eq('id', mentorshipData.id);

      if (updateError) {
        throw new Error(`Failed to update sessions: ${updateError.message}`);
      }
    },
    { mentorshipId: mentorshipData.id, amount }
  );

  await interaction.editReply(`✅ ${student.tag} now has ${newRemaining}/${newTotal} sessions.`);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'addsessions',
  });
}