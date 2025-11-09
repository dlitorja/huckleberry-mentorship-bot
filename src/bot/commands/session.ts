// src/bot/commands/session.ts

import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('session')
  .setDescription('Update remaining sessions for a student.')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student to update')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const student = interaction.options.getUser('student', true);
  const instructorId = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data, error } = await supabase
    .from('mentorships')
    .select('id, sessions_remaining, total_sessions')
    .eq('mentee_id', student.id)
    .eq('instructor_id', instructorId)
    .single();

  if (error) {
    console.error('Supabase error:', error);
  }

  if (error || !data) {
    await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
    return;
  }

  // Prevent going below zero
  const newCount = Math.max(0, data.sessions_remaining - 1);
  const { error: updateError } = await supabase
    .from('mentorships')
    .update({ sessions_remaining: newCount })
    .eq('id', data.id);

  if (updateError) {
    console.error('Supabase error:', updateError);
    await interaction.editReply(`Failed to update ${student.tag}.`);
    return;
  }

  let message = `${student.tag} updated. Remaining sessions: ${newCount}/${data.total_sessions}.`;
  if (newCount === 0) {
    message += ' ⚠️ All sessions used!';
  }

  await interaction.editReply(message);
}