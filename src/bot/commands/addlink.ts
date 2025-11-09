// src/bot/commands/addlink.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('addlink')
  .setDescription('Add a resource link to a session.')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('url')
      .setDescription('The URL to add')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('title')
      .setDescription('Optional title/description for the link')
      .setRequired(false)
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
  const url = interaction.options.getString('url', true);
  const title = interaction.options.getString('title');
  const dateInput = interaction.options.getString('date');
  const instructorDiscordId = interaction.user.id;

  // Validate URL
  try {
    new URL(url);
  } catch {
    await interaction.editReply('❌ Invalid URL. Please provide a valid URL (e.g., https://example.com)');
    return;
  }

  // Parse date
  let sessionDate: Date;
  if (dateInput) {
    sessionDate = new Date(dateInput);
    if (isNaN(sessionDate.getTime())) {
      await interaction.editReply('❌ Invalid date format. Use YYYY-MM-DD or MM/DD/YYYY, or leave blank for today.');
      return;
    }
  } else {
    sessionDate = new Date();
  }

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
    .select('id, status')
    .eq('mentee_id', menteeData.id)
    .eq('instructor_id', instructorData.id)
    .eq('status', 'active')  // Only add links to active mentorships
    .single();

  if (mentorshipError || !mentorshipData) {
    await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
    return;
  }

  // Get or create session note for this date
  let { data: sessionNote, error: noteError } = await supabase
    .from('session_notes')
    .select('id')
    .eq('mentorship_id', mentorshipData.id)
    .eq('session_date', dateOnly)
    .maybeSingle();

  if (!sessionNote) {
    // Create session note
    const { data: newNote, error: createError } = await supabase
      .from('session_notes')
      .insert({
        mentorship_id: mentorshipData.id,
        session_date: dateOnly,
        notes: null,
        created_by_discord_id: instructorDiscordId
      })
      .select('id')
      .single();

    if (createError || !newNote) {
      console.error('Failed to create session note:', createError);
      await interaction.editReply('❌ Failed to create session note.');
      return;
    }
    sessionNote = newNote;
  }

  // Add link to session
  const { error: linkError } = await supabase
    .from('session_links')
    .insert({
      session_note_id: sessionNote.id,
      url: url,
      title: title || new URL(url).hostname
    });

  if (linkError) {
    console.error('Failed to add link:', linkError);
    await interaction.editReply('❌ Failed to add link.');
    return;
  }

  const dateDisplay = sessionDate.toLocaleDateString('en-US', { dateStyle: 'medium' });

  await interaction.editReply(
    `✅ **Link added to session!**\n\n` +
    `👤 **Student:** ${student.tag}\n` +
    `📅 **Date:** ${dateDisplay}\n` +
    `🔗 **Link:** ${title || url.substring(0, 50)}${url.length > 50 ? '...' : ''}\n\n` +
    `Use \`/viewnotes\` to see all session notes and links.`
  );
}

