// src/bot/commands/liststudents.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';

export const data = new SlashCommandBuilder()
  .setName('liststudents')
  .setDescription('List all your students and remaining sessions.');

async function executeCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const instructorDiscordId = interaction.user.id;

  // Lookup instructor UUID with performance monitoring
  const instructorData = await measurePerformance(
    'liststudents.instructor_lookup',
    async () => {
      const { data, error } = await supabase
        .from('instructors')
        .select('id')
        .eq('discord_id', instructorDiscordId)
        .single();

      if (error || !data) {
        throw new Error(`Instructor not found: ${error?.message || 'Unknown error'}`);
      }
      return data;
    },
    { instructorDiscordId }
  );

  // Fetch mentorships with performance monitoring
  type SupabaseMentorshipRow = {
    mentee_id: string;
    sessions_remaining: number;
    total_sessions: number;
    last_session_date: string | null;
    status: string;
    mentees: { discord_id: string | null } | { discord_id: string | null }[] | null;
  };

  type MentorshipRow = {
    mentee_id: string;
    sessions_remaining: number;
    total_sessions: number;
    last_session_date: string | null;
    status: string;
    mentees: { discord_id: string | null } | null;
  };

  const data = await measurePerformance(
    'liststudents.mentorships_lookup',
    async () => {
      const { data, error } = await supabase
        .from('mentorships')
        .select('mentee_id, sessions_remaining, total_sessions, last_session_date, status, mentees(discord_id)')
        .eq('instructor_id', instructorData.id)
        .eq('status', 'active');  // Only show active mentorships

      if (error) {
        throw new Error(`Failed to fetch mentorships: ${error.message}`);
      }
      if (!data || data.length === 0) {
        return [];
      }
      
      // Normalize mentees to always be a single object (Supabase may return array)
      return (data as SupabaseMentorshipRow[]).map(row => ({
        ...row,
        mentees: Array.isArray(row.mentees) ? (row.mentees[0] || null) : row.mentees
      })) as MentorshipRow[];
    },
    { instructorId: instructorData.id }
  );

  if (data.length === 0) {
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
      
      return `<@${row.mentees?.discord_id}> – ${row.sessions_remaining}/${row.total_sessions} sessions | Last: ${lastSession}${zeroIndicator}`;
    })
    .join('\n');

  let finalMessage = message || 'No students found.';
  
  // Add summary if students at zero
  if (studentsAtZero > 0) {
    finalMessage += `\n\n⚠️ **${studentsAtZero} student${studentsAtZero === 1 ? '' : 's'} at 0 sessions** - Consider reaching out about renewal plans.`;
  }

  await interaction.editReply(finalMessage);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'liststudents',
  });
}