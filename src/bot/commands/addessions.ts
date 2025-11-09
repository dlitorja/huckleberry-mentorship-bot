// src/bot/commands/addsessions.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

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
      .setDescription('Number of sessions to add')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const student = interaction.options.getUser('student', true);
  const instructorDiscordId = interaction.user.id;
  const amount = interaction.options.getInteger('amount', true);

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
    .select('sessions_remaining, total_sessions, id, status')
    .eq('mentee_id', menteeData.id)
    .eq('instructor_id', instructorData.id)
    .eq('status', 'active')  // Only add sessions to active mentorships
    .single();

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
    await interaction.editReply(`Failed to update sessions for ${student.tag}.`);
    return;
  }

  await interaction.editReply(`${student.tag} now has ${newRemaining}/${newTotal} sessions.`);
}