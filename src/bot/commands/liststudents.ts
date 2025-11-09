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
    .select('mentee_id, sessions_remaining, total_sessions, mentees(discord_id)')
    .eq('instructor_id', instructorData.id);

  if (error || !data || data.length === 0) {
    console.error('Mentorships lookup error:', error);
    await interaction.editReply('No students found.');
    return;
  }

  const message = data
    .map(
      row => `<@${(row.mentees as any)?.discord_id}> – ${row.sessions_remaining}/${row.total_sessions} sessions`
    )
    .join('\n');

  await interaction.editReply(message);
}