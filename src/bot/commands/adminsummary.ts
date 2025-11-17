// src/bot/commands/adminsummary.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';

export const data = new SlashCommandBuilder()
  .setName('adminsummary')
  .setDescription('Admin only: View all mentorships and session counts');

async function executeCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Admin check - only the configured admin can use this command
  const ADMIN_USER_ID = CONFIG.DISCORD_ADMIN_ID;
  
  if (!ADMIN_USER_ID) {
    await interaction.editReply('⚠️ Admin user ID is not configured.');
    return;
  }
  
  if (interaction.user.id !== ADMIN_USER_ID) {
    await interaction.editReply('⛔ This command is only available to administrators.');
    return;
  }

  // Fetch all mentorships with instructor and mentee details in a single query
  // Only show active mentorships (exclude ended ones)
  const mentorships = await measurePerformance(
    'adminsummary.fetch_mentorships',
    async () => {
      const { data, error } = await supabase
        .from('mentorships')
        .select(`
          sessions_remaining,
          total_sessions,
          last_session_date,
          status,
          instructors!mentorships_instructor_id_fkey(discord_id),
          mentees!mentorships_mentee_id_fkey(discord_id)
        `)
        .eq('status', 'active')
        .order('instructors(discord_id)');

      if (error) {
        throw new Error(`Failed to fetch mentorship data: ${error.message}`);
      }
      return data || [];
    }
  );

  if (!mentorships || mentorships.length === 0) {
    await interaction.editReply('No mentorships found in the database.');
    return;
  }

  // Group by instructor
  // Type definition for documentation (mentorships array shape)
  type _MentorshipRow = {
    sessions_remaining: number;
    total_sessions: number;
    last_session_date?: string | null;
    status: string;
    instructors?: { discord_id?: string | null } | null | Array<{ discord_id?: string | null }>;
    mentees?: { discord_id?: string | null } | null | Array<{ discord_id?: string | null }>;
  };
  type StudentSummary = { menteeId?: string | null; remaining: number; total: number; lastSession?: string | null };
  const groupedByInstructor = mentorships.reduce<Record<string, StudentSummary[]>>((acc, m) => {
    const instructor = Array.isArray(m.instructors) ? m.instructors[0] : m.instructors;
    const mentee = Array.isArray(m.mentees) ? m.mentees[0] : m.mentees;
    const instructorId = instructor?.discord_id || 'Unknown';
    if (!acc[instructorId]) {
      acc[instructorId] = [];
    }
    acc[instructorId].push({
      menteeId: mentee?.discord_id,
      remaining: m.sessions_remaining,
      total: m.total_sessions,
      lastSession: m.last_session_date
    });
    return acc;
  }, {});

  // Format output
  let message = '📊 **Mentorship Summary (All Instructors)**\n\n';
  let studentsAtZero = 0;
  
  for (const [instructorId, students] of Object.entries(groupedByInstructor)) {
    message += `**Instructor:** <@${instructorId}>\n`;
    students.forEach((s: StudentSummary) => {
      const lastSession = s.lastSession 
        ? new Date(s.lastSession).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'No sessions yet';
      
      // Add visual indicator for 0 sessions
      const zeroIndicator = s.remaining === 0 ? ' ⚠️ **NEEDS ATTENTION**' : '';
      if (s.remaining === 0) studentsAtZero++;
      
      message += `  └ <@${s.menteeId}>: ${s.remaining}/${s.total} sessions | Last: ${lastSession}${zeroIndicator}\n`;
    });
    message += '\n';
  }
  
  // Add summary at the end
  if (studentsAtZero > 0) {
    message += `\n⚠️ **${studentsAtZero} student${studentsAtZero === 1 ? '' : 's'} at 0 sessions** - Consider reaching out about renewal plans.\n`;
  }

  // Discord has a 2000 character limit, split if needed
  if (message.length > 2000) {
    await interaction.editReply('Summary too long! Showing first 2000 characters:\n\n' + message.substring(0, 1950));
  } else {
    await interaction.editReply(message);
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'adminsummary',
  });
}

