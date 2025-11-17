// src/bot/commands/addlink.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { getMentorshipByDiscordIds } from '../../utils/mentorship.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { validateUrl, validateDate } from '../../utils/validation.js';

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

async function executeCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const student = interaction.options.getUser('student', true);
  const urlInput = interaction.options.getString('url', true);
  const title = interaction.options.getString('title');
  const dateInput = interaction.options.getString('date');
  const instructorDiscordId = interaction.user.id;

  // Validate URL
  const url = validateUrl(urlInput, 'url');

  // Parse and validate date
  let sessionDate: Date;
  if (dateInput) {
    try {
      sessionDate = validateDate(dateInput, 'date', false);
    } catch (validationError) {
      await interaction.editReply(
        `❌ ${validationError instanceof Error ? validationError.message : 'Invalid date format'}\n\n` +
        `Use YYYY-MM-DD or MM/DD/YYYY, or leave blank for today.`
      );
      return;
    }
  } else {
    sessionDate = new Date();
  }

  const dateOnly = sessionDate.toISOString().split('T')[0];

  // Optimized mentorship lookup with performance monitoring
  const mentorshipData = await measurePerformance(
    'addlink.mentorship_lookup',
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

  // Get or create session note for this date with performance monitoring
  const sessionNote = await measurePerformance(
    'addlink.get_or_create_note',
    async () => {
      // Check for existing note
      const { data: existingNote, error: checkError } = await supabase
        .from('session_notes')
        .select('id')
        .eq('mentorship_id', mentorshipData.id)
        .eq('session_date', dateOnly)
        .maybeSingle();

      if (checkError) {
        throw new Error(`Failed to check existing note: ${checkError.message}`);
      }

      if (existingNote) {
        return existingNote;
      }

      // Create new note
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
        throw new Error(`Failed to create session note: ${createError?.message || 'Unknown error'}`);
      }
      return newNote;
    },
    { mentorshipId: mentorshipData.id, dateOnly }
  );

  // Add link to session with performance monitoring
  await measurePerformance(
    'addlink.insert_link',
    async () => {
      const { error: linkError } = await supabase
        .from('session_links')
        .insert({
          session_note_id: sessionNote.id,
          url: url,
          title: title || new URL(url).hostname
        });

      if (linkError) {
        throw new Error(`Failed to add link: ${linkError.message}`);
      }
    },
    { sessionNoteId: sessionNote.id }
  );

  const dateDisplay = sessionDate.toLocaleDateString('en-US', { dateStyle: 'medium' });

  await interaction.editReply(
    `✅ **Link added to session!**\n\n` +
    `👤 **Student:** ${student.tag}\n` +
    `📅 **Date:** ${dateDisplay}\n` +
    `🔗 **Link:** ${title || url.substring(0, 50)}${url.length > 50 ? '...' : ''}\n\n` +
    `Use \`/viewnotes\` to see all session notes and links.`
  );
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'addlink',
  });
}

