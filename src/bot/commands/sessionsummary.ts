// src/bot/commands/sessionsummary.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { supabase as _supabase } from '../supabaseClient.js';
import { getMentorshipByDiscordIds } from '../../utils/mentorship.js';

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

  const lastSession = data.last_session_date 
    ? new Date(data.last_session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No sessions yet';
  
  await interaction.editReply(
    `${student} – ${data.sessions_remaining}/${data.total_sessions} sessions remaining.\n` +
    `📅 **Last session:** ${lastSession}`
  );
}