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
  )
  .addStringOption(option =>
    option
      .setName('date')
      .setDescription('Session date (YYYY-MM-DD or MM/DD/YYYY). Leave blank for today.')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const student = interaction.options.getUser('student', true);
  const instructorDiscordId = interaction.user.id;
  const dateInput = interaction.options.getString('date');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Parse and validate date
  let sessionDate: Date;
  if (dateInput) {
    // Try to parse the date
    sessionDate = new Date(dateInput);
    
    // Check if date is valid
    if (isNaN(sessionDate.getTime())) {
      await interaction.editReply(
        `❌ Invalid date format. Please use:\n` +
        `• YYYY-MM-DD (e.g., 2025-11-09)\n` +
        `• MM/DD/YYYY (e.g., 11/09/2025)\n` +
        `• Or leave blank for today`
      );
      return;
    }
    
    // Check if date is in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (sessionDate > today) {
      await interaction.editReply(`❌ Session date cannot be in the future.`);
      return;
    }
  } else {
    // Use today if no date specified
    sessionDate = new Date();
  }

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
    .select('id, sessions_remaining, total_sessions, status')
    .eq('mentee_id', menteeData.id)
    .eq('instructor_id', instructorData.id)
    .eq('status', 'active')  // Only update active mentorships
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
    .update({ 
      sessions_remaining: newCount,
      last_session_date: sessionDate.toISOString()
    })
    .eq('id', data.id);

  if (updateError) {
    console.error('Supabase error:', updateError);
    await interaction.editReply(`Failed to update ${student.tag}.`);
    return;
  }

  // Format date for display
  const dateDisplay = sessionDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  let message = `✅ ${student.tag} updated.\n\n`;
  message += `📊 **Remaining sessions:** ${newCount}/${data.total_sessions}\n`;
  message += `📅 **Last session:** ${dateDisplay}`;
  
  if (newCount === 0) {
    message += '\n\n⚠️ **All sessions used!**';
  }

  await interaction.editReply(message);
}