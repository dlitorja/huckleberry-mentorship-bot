// src/bot/commands/viewnotes.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { getMentorshipByDiscordIds } from '../../utils/mentorship.js';

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
      .setDescription('Number of recent sessions to show (default: 5)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const student = interaction.options.getUser('student', true);
  const limit = interaction.options.getInteger('limit') || 5;
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
  const isAdmin = userDiscordId === process.env.DISCORD_ADMIN_ID;

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
    // User is viewing their own notes - get any mentorship for this mentee
    const { data: mentorshipData, error: mentorshipError } = await supabase
      .from('mentorships')
      .select('id')
      .eq('mentee_id', menteeData.id)
      .limit(1)
      .single();

    if (mentorshipError || !mentorshipData) {
      await interaction.editReply('Could not find your mentorship record.');
      return;
    }
    mentorshipId = mentorshipData.id;
  } else if (isAdmin) {
    // Admin viewing any student - get their most recent mentorship
    const { data: mentorshipData, error: mentorshipError } = await supabase
      .from('mentorships')
      .select('id')
      .eq('mentee_id', menteeData.id)
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

  // Fetch session notes
  const { data: notes, error: notesError } = await supabase
    .from('session_notes')
    .select('id, session_date, notes, created_at')
    .eq('mentorship_id', mentorshipId)
    .order('session_date', { ascending: false })
    .limit(limit);

  if (notesError) {
    console.error('Error fetching notes:', notesError);
    await interaction.editReply('❌ Failed to fetch session notes.');
    return;
  }

  if (!notes || notes.length === 0) {
    await interaction.editReply(`📝 No session notes found for ${student.tag}.`);
    return;
  }

  // Fetch links for these notes
  const noteIds = notes.map((n: any) => n.id);
  const { data: links } = await supabase
    .from('session_links')
    .select('session_note_id, url, title')
    .in('session_note_id', noteIds);

  const linksByNoteId = (links || []).reduce((acc: any, link: any) => {
    if (!acc[link.session_note_id]) acc[link.session_note_id] = [];
    acc[link.session_note_id].push(link);
    return acc;
  }, {});

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(`📝 Session Notes: ${student.tag}`)
    .setColor(0x5865F2)
    .setTimestamp();

  // Add fields for each session
  notes.forEach((note: any, index: number) => {
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
        sessionLinks.forEach((link: any) => {
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

  if (notes.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${notes.length} sessions` });
  }

  await interaction.editReply({ embeds: [embed] });
}

