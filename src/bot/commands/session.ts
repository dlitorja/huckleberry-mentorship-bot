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
  const instructorDiscordId = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Lookup instructor UUID
  const { data: instructorData, error: instructorError } = await supabase
    .from('instructors')
    .select('id')
    .eq('discord_id', instructorDiscordId)
    .single();

  if (instructorError || !instructorData) {
    console.error('Instructor lookup error:', instructorError);
    await interaction.editReply('Instructor not found in the database.');
    return;
  }

  // Lookup mentee UUID
  const { data: menteeData, error: menteeError } = await supabase
    .from('mentees')
    .select('id')
    .eq('discord_id', student.id)
    .single();

  if (menteeError || !menteeData) {
    console.error('Mentee lookup error:', menteeError);
    await interaction.editReply('Student not found in the database.');
    return;
  }

  // Lookup mentorship record
  const { data, error } = await supabase
    .from('mentorships')
    .select('id, sessions_remaining, total_sessions')
    .eq('mentee_id', menteeData.id)
    .eq('instructor_id', instructorData.id)
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