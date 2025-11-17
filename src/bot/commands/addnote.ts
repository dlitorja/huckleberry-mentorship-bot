// src/bot/commands/addnote.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { getMentorshipByDiscordIds } from '../../utils/mentorship.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { validateDate, validateNonEmptyString } from '../../utils/validation.js';

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

async function executeCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const student = interaction.options.getUser('student', true);
  const notesInput = interaction.options.getString('notes', true);
  const dateInput = interaction.options.getString('date');
  const instructorDiscordId = interaction.user.id;

  // Validate notes
  const notes = validateNonEmptyString(notesInput, 'notes', 5000);

  // Parse and validate date
  let sessionDate: Date;
  if (dateInput) {
    try {
      sessionDate = validateDate(dateInput, 'date', false);
    } catch (validationError) {
      await interaction.editReply(
        `❌ ${validationError instanceof Error ? validationError.message : 'Invalid date format'}\n\n` +
        `Please use:\n` +
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

  // Optimized mentorship lookup with performance monitoring
  const mentorshipData = await measurePerformance(
    'addnote.mentorship_lookup',
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

  // Check if note already exists for this date
  const existingNote = await measurePerformance(
    'addnote.check_existing_note',
    async () => {
      const { data, error } = await supabase
        .from('session_notes')
        .select('id')
        .eq('mentorship_id', mentorshipData.id)
        .eq('session_date', dateOnly)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to check existing note: ${error.message}`);
      }
      return data;
    },
    { mentorshipId: mentorshipData.id, dateOnly }
  );

  if (existingNote) {
    // Update existing note with performance monitoring
    await measurePerformance(
      'addnote.update_note',
      async () => {
        const { error: updateError } = await supabase
          .from('session_notes')
          .update({
            notes: notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingNote.id);

        if (updateError) {
          throw new Error(`Failed to update note: ${updateError.message}`);
        }
      },
      { noteId: existingNote.id }
    );

    await interaction.editReply(
      `✅ **Session note updated!**\n\n` +
      `👤 **Student:** ${student.tag}\n` +
      `📅 **Date:** ${sessionDate.toLocaleDateString('en-US', { dateStyle: 'medium' })}\n` +
      `📝 **Notes:** ${notes.substring(0, 200)}${notes.length > 200 ? '...' : ''}`
    );
  } else {
    // Create new note with performance monitoring
    await measurePerformance(
      'addnote.create_note',
      async () => {
        const { error: insertError } = await supabase
          .from('session_notes')
          .insert({
            mentorship_id: mentorshipData.id,
            session_date: dateOnly,
            notes: notes,
            created_by_discord_id: instructorDiscordId
          });

        if (insertError) {
          throw new Error(`Failed to add note: ${insertError.message}`);
        }
      },
      { mentorshipId: mentorshipData.id, dateOnly }
    );

    await interaction.editReply(
      `✅ **Session note added!**\n\n` +
      `👤 **Student:** ${student.tag}\n` +
      `📅 **Date:** ${sessionDate.toLocaleDateString('en-US', { dateStyle: 'medium' })}\n` +
      `📝 **Notes:** ${notes.substring(0, 200)}${notes.length > 200 ? '...' : ''}`
    );
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'addnote',
  });
}

