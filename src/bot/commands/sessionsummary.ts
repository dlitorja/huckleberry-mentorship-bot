// src/bot/commands/sessionsummary.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('sessionsummary')
  .setDescription('Tag a student and show their remaining sessions.')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student to look up')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const student = interaction.options.getUser('student', true);
  const instructorDiscordId = interaction.user.id;

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
    .select('sessions_remaining, total_sessions')
    .eq('mentee_id', menteeData.id)
    .eq('instructor_id', instructorData.id)
    .single();

  if (error || !data) {
    console.error('Mentorship lookup error:', error);
    await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
    return;
  }

  await interaction.editReply(`${student} – ${data.sessions_remaining}/${data.total_sessions} sessions remaining.`);
}