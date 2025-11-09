// src/bot/commands/liststudents.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { supabase } from '../supabaseClient';

export const data = new SlashCommandBuilder()
  .setName('liststudents')
  .setDescription('List all your students and remaining sessions.');

export async function execute(interaction: ChatInputCommandInteraction) {
  const instructorId = interaction.user.id;

  const { data, error } = await supabase
    .from('mentorships')
    .select('mentee_id, sessions_remaining, total_sessions')
    .eq('instructor_id', instructorId);

  if (error || !data || data.length === 0) {
    await interaction.reply({
      content: 'No students found.',
      ephemeral: true,
    });
    return;
  }

  const message = data
    .map(
      row => `<@${row.mentee_id}> – ${row.sessions_remaining}/${row.total_sessions} sessions`
    )
    .join('\n');

  await interaction.reply({
    content: message,
    ephemeral: true,
  });
}