// src/bot/commands/addsessions.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { getMentorshipByDiscordIds } from '../../utils/mentorship.js';
import { validatePositiveInteger, ValidationError } from '../../utils/validation.js';
import { handleError } from '../../utils/errors.js';

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

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const student = interaction.options.getUser('student', true);
    const instructorDiscordId = interaction.user.id;
    const amountInput = interaction.options.getInteger('amount', true);

    // Validate amount
    const amount = validatePositiveInteger(amountInput, 'amount', 1, 100);

  // Optimized mentorship lookup
  const { data, error } = await getMentorshipByDiscordIds({
    instructorDiscordId,
    menteeDiscordId: student.id,
    status: 'active'
  });

  if (error || !data) {
    console.error('Mentorship lookup error:', error);
    await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
    return;
  }

    const newRemaining = data.sessions_remaining + amount;
    const newTotal = Math.max(data.total_sessions, newRemaining);

    const { error: updateError } = await supabase
      .from('mentorships')
      .update({ sessions_remaining: newRemaining, total_sessions: newTotal })
      .eq('id', data.id);

    if (updateError) {
      console.error('Failed to update sessions:', updateError);
      await interaction.editReply(`❌ Failed to update sessions for ${student.tag}.`);
      return;
    }

    await interaction.editReply(`✅ ${student.tag} now has ${newRemaining}/${newTotal} sessions.`);
  } catch (error) {
    const appError = handleError(error, 'addsessions command');
    
    if (appError instanceof ValidationError) {
      await interaction.editReply(`❌ ${appError.message}`);
    } else {
      console.error('Unexpected error in addsessions:', appError);
      await interaction.editReply(`❌ An unexpected error occurred: ${appError.message}`);
    }
  }
}