// src/bot/commands/liststudents.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('liststudents')
  .setDescription('List all your students and remaining sessions.');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

  const { data, error } = await supabase
    .from('mentorships')
    .select('mentee_id, sessions_remaining, total_sessions, last_session_date, status, mentees(discord_id)')
    .eq('instructor_id', instructorData.id)
    .eq('status', 'active');  // Only show active mentorships

  if (error || !data || data.length === 0) {
    console.error('Mentorships lookup error:', error);
    await interaction.editReply('No students found.');
    return;
  }

  let studentsAtZero = 0;
  
  const message = data
    .map(row => {
      const lastSession = row.last_session_date 
        ? new Date(row.last_session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No sessions yet';
      
      // Add visual indicator for 0 sessions
      const zeroIndicator = row.sessions_remaining === 0 ? ' ⚠️ **NEEDS ATTENTION**' : '';
      if (row.sessions_remaining === 0) studentsAtZero++;
      
      return `<@${(row.mentees as any)?.discord_id}> – ${row.sessions_remaining}/${row.total_sessions} sessions | Last: ${lastSession}${zeroIndicator}`;
    })
    .join('\n');

  let finalMessage = message || 'No students found.';
  
  // Add summary if students at zero
  if (studentsAtZero > 0) {
    finalMessage += `\n\n⚠️ **${studentsAtZero} student${studentsAtZero === 1 ? '' : 's'} at 0 sessions** - Consider reaching out about renewal plans.`;
  }

  await interaction.editReply(finalMessage);
}