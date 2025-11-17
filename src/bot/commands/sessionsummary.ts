// src/bot/commands/sessionsummary.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { supabase as _supabase } from '../supabaseClient.js';
import { getMentorshipByDiscordIds } from '../../utils/mentorship.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';

export const data = new SlashCommandBuilder()
  .setName('sessionsummary')
  .setDescription('Tag a student and show their remaining sessions.')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student to look up')
      .setRequired(true)
  );

async function executeCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const student = interaction.options.getUser('student', true);
  const instructorDiscordId = interaction.user.id;

  // Optimized mentorship lookup with performance monitoring
  const mentorshipData = await measurePerformance(
    'sessionsummary.mentorship_lookup',
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

  const lastSession = mentorshipData.last_session_date 
    ? new Date(mentorshipData.last_session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No sessions yet';
  
  await interaction.editReply(
    `${student} – ${mentorshipData.sessions_remaining}/${mentorshipData.total_sessions} sessions remaining.\n` +
    `📅 **Last session:** ${lastSession}`
  );
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'sessionsummary',
  });
}