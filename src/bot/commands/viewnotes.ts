// src/bot/commands/viewnotes.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';
import { getMentorshipByDiscordIds, getAnyMentorshipForMentee } from '../../utils/mentorship.js';
import type { SessionNoteWithLinks } from '../../types/database.js';

export const data = new SlashCommandBuilder()
  .setName('viewnotes')
  .setDescription('View session notes for a student.')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('Number of recent sessions to show (default: 5, max: 25)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25)
  )
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Page number (default: 1)')
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const student = interaction.options.getUser('student', true);
  const limitInput = interaction.options.getInteger('limit') || 5;
  const page = interaction.options.getInteger('page') || 1;
  const limit = Math.min(Math.max(1, limitInput), 25); // Clamp between 1 and 25
  const userDiscordId = interaction.user.id;

  // Check if user is instructor or student
  const { data: instructorData } = await supabase
    .from('instructors')
    .select('id')
    .eq('discord_id', userDiscordId)
    .maybeSingle();

  const { data: menteeData } = await supabase
    .from('mentees')
    .select('id')
    .eq('discord_id', student.id)
    .single();

  if (!menteeData) {
    await interaction.editReply('Student not found in the database.');
    return;
  }

  // Determine mentorship ID
  let mentorshipId: string;

  // Check if user is admin (admin can view anyone)
  const isAdmin = userDiscordId === CONFIG.DISCORD_ADMIN_ID;

  if (instructorData) {
    // User is an instructor - get their mentorship with this student (optimized)
    const { data: mentorshipData, error: mentorshipError } = await getMentorshipByDiscordIds({
      instructorDiscordId: userDiscordId,
      menteeDiscordId: student.id
    });

    if (mentorshipError || !mentorshipData) {
      await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
      return;
    }
    mentorshipId = mentorshipData.id;
  } else if (userDiscordId === student.id) {
    // User is viewing their own notes - get active mentorship for this mentee
    const { data: mentorshipData, error: mentorshipError } = await getAnyMentorshipForMentee(
      student.id,
      true // requireActive = true to only get active mentorships
    );

    if (mentorshipError || !mentorshipData) {
      await interaction.editReply('Could not find your mentorship record.');
      return;
    }
    mentorshipId = mentorshipData.id;
  } else if (isAdmin) {
    // Admin viewing any student - get their most recent active mentorship
    const { data: mentorshipData, error: mentorshipError } = await supabase
      .from('mentorships')
      .select('id')
      .eq('mentee_id', menteeData.id)
      .eq('status', 'active') // Only get active mentorships
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (mentorshipError || !mentorshipData) {
      await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
      return;
    }
    mentorshipId = mentorshipData.id;
  } else {
    await interaction.editReply('⛔ You can only view notes for your own students or yourself.');
    return;
  }

  // Fetch session notes with links in a single query (fixes N+1 issue)
  // Add pagination support
  const offset = (page - 1) * limit;
  const { data: notes, error: notesError, count } = await supabase
    .from('session_notes')
    .select(`
      id,
      session_date,
      notes,
      created_at,
      session_links (
        session_note_id,
        url,
        title
      )
    `, { count: 'exact' })
    .eq('mentorship_id', mentorshipId)
    .order('session_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (notesError) {
    console.error('Error fetching notes:', notesError);
    await interaction.editReply('❌ Failed to fetch session notes.');
    return;
  }

  if (!notes || notes.length === 0) {
    await interaction.editReply(`📝 No session notes found for ${student.tag}.`);
    return;
  }

  // Organize links by note ID (from the joined data)
  const linksByNoteId: Record<string, Array<{ url: string; title: string | null }>> = {};
  (notes as SessionNoteWithLinks[]).forEach((note) => {
    if (note.session_links && Array.isArray(note.session_links)) {
      linksByNoteId[note.id] = note.session_links;
    }
  });

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(`📝 Session Notes: ${student.tag}`)
    .setColor(0x5865F2)
    .setTimestamp();

  // Add fields for each session
  (notes as SessionNoteWithLinks[]).forEach((note, index: number) => {
    if (index < 10) { // Limit to 10 sessions to avoid embed limits
      const date = new Date(note.session_date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      let fieldValue = note.notes || 'No notes';
      
      // Truncate if too long
      if (fieldValue.length > 300) {
        fieldValue = fieldValue.substring(0, 297) + '...';
      }

      // Add links if any
      const sessionLinks = linksByNoteId[note.id];
      if (sessionLinks && sessionLinks.length > 0) {
        fieldValue += '\n\n🔗 **Links:**\n';
        sessionLinks.forEach((link: { url: string; title: string | null }) => {
          fieldValue += `• [${link.title || 'Link'}](${link.url})\n`;
        });
      }

      embed.addFields({
        name: `📅 ${date}`,
        value: fieldValue,
        inline: false
      });
    }
  });

  // Add pagination info to footer
  const totalSessions = count || notes.length;
  const totalPages = Math.ceil(totalSessions / limit);
  if (totalPages > 1) {
    embed.setFooter({ 
      text: `Page ${page} of ${totalPages} • Showing ${notes.length} of ${totalSessions} sessions` 
    });
  } else if (totalSessions > limit) {
    embed.setFooter({ text: `Showing ${notes.length} of ${totalSessions} sessions` });
  }

  await interaction.editReply({ embeds: [embed] });
}

