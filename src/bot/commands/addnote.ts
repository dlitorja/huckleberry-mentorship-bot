// src/bot/commands/addnote.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('addnote')
  .setDescription('Add notes to a session with a student.')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('notes')
      .setDescription('Session notes (what was covered, key takeaways, etc.)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('date')
      .setDescription('Session date (YYYY-MM-DD or MM/DD/YYYY). Leave blank for today.')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const student = interaction.options.getUser('student', true);
  const notes = interaction.options.getString('notes', true);
  const dateInput = interaction.options.getString('date');
  const instructorDiscordId = interaction.user.id;

  // Parse date
  let sessionDate: Date;
  if (dateInput) {
    sessionDate = new Date(dateInput);
    if (isNaN(sessionDate.getTime())) {
      await interaction.editReply(
        `❌ Invalid date format. Please use:\n` +
        `• YYYY-MM-DD (e.g., 2025-11-09)\n` +
        `• MM/DD/YYYY (e.g., 11/09/2025)\n` +
        `• Or leave blank for today`
      );
      return;
    }
  } else {
    sessionDate = new Date();
  }

  // Format date for database (date only, no time)
  const dateOnly = sessionDate.toISOString().split('T')[0];

  // Lookup instructor UUID
  const { data: instructorData, error: instructorError } = await supabase
    .from('instructors')
    .select('id')
    .eq('discord_id', instructorDiscordId)
    .single();

  if (instructorError || !instructorData) {
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
    await interaction.editReply('Student not found in the database.');
    return;
  }

  // Get mentorship ID
  const { data: mentorshipData, error: mentorshipError } = await supabase
    .from('mentorships')
    .select('id')
    .eq('mentee_id', menteeData.id)
    .eq('instructor_id', instructorData.id)
    .single();

  if (mentorshipError || !mentorshipData) {
    await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
    return;
  }

  // Check if note already exists for this date
  const { data: existingNote, error: checkError } = await supabase
    .from('session_notes')
    .select('id')
    .eq('mentorship_id', mentorshipData.id)
    .eq('session_date', dateOnly)
    .maybeSingle();

  if (existingNote) {
    // Update existing note
    const { error: updateError } = await supabase
      .from('session_notes')
      .update({
        notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingNote.id);

    if (updateError) {
      console.error('Failed to update note:', updateError);
      await interaction.editReply('❌ Failed to update session note.');
      return;
    }

    await interaction.editReply(
      `✅ **Session note updated!**\n\n` +
      `👤 **Student:** ${student.tag}\n` +
      `📅 **Date:** ${sessionDate.toLocaleDateString('en-US', { dateStyle: 'medium' })}\n` +
      `📝 **Notes:** ${notes.substring(0, 200)}${notes.length > 200 ? '...' : ''}`
    );
  } else {
    // Create new note
    const { error: insertError } = await supabase
      .from('session_notes')
      .insert({
        mentorship_id: mentorshipData.id,
        session_date: dateOnly,
        notes: notes,
        created_by_discord_id: instructorDiscordId
      });

    if (insertError) {
      console.error('Failed to add note:', insertError);
      await interaction.editReply('❌ Failed to add session note.');
      return;
    }

    await interaction.editReply(
      `✅ **Session note added!**\n\n` +
      `👤 **Student:** ${student.tag}\n` +
      `📅 **Date:** ${sessionDate.toLocaleDateString('en-US', { dateStyle: 'medium' })}\n` +
      `📝 **Notes:** ${notes.substring(0, 200)}${notes.length > 200 ? '...' : ''}`
    );
  }
}

