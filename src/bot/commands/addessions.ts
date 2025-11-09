// src/bot/commands/addsessions.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
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
  const student = interaction.options.getUser('student', true);
  const instructorId = interaction.user.id;
  const amount = interaction.options.getInteger('amount', true);

  const { data, error } = await supabase
    .from('mentorships')
    .select('sessions_remaining, total_sessions, id')
    .eq('mentee_id', student.id)
    .eq('instructor_id', instructorId)
    .single();

  if (error || !data) {
    await interaction.reply({
      content: `Could not find a mentorship record for ${student.tag}.`,
      ephemeral: true,
    });
    return;
  }

  const newRemaining = data.sessions_remaining + amount;
  const newTotal = Math.max(data.total_sessions, newRemaining);

  const { error: updateError } = await supabase
    .from('mentorships')
    .update({ sessions_remaining: newRemaining, total_sessions: newTotal })
    .eq('id', data.id);

  if (updateError) {
    await interaction.reply({
      content: `Failed to update sessions for ${student.tag}.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `${student.tag} now has ${newRemaining}/${newTotal} sessions.`,
    ephemeral: false,
  });
}