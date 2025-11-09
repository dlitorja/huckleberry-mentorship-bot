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
  await interaction.deferReply({ ephemeral: false });

  const student = interaction.options.getUser('student', true);
  const instructorId = interaction.user.id;

  const { data, error } = await supabase
    .from('mentorships')
    .select('sessions_remaining, total_sessions')
    .eq('mentee_id', student.id)
    .eq('instructor_id', instructorId)
    .single();

  if (error || !data) {
    await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
    return;
  }

  await interaction.editReply(`${student} – ${data.sessions_remaining}/${data.total_sessions} sessions remaining.`);
}