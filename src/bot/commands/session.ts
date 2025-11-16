// src/bot/commands/session.ts

import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { sendTestimonialRequest } from '../../utils/testimonialRequest.js';
import { getMentorshipByDiscordIds } from '../../utils/mentorship.js';

export const data = new SlashCommandBuilder()
  .setName('session')
  .setDescription('Update remaining sessions for a student.')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student to update')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('date')
      .setDescription('Session date (YYYY-MM-DD or MM/DD/YYYY). Leave blank for today.')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const student = interaction.options.getUser('student', true);
  const instructorDiscordId = interaction.user.id;
  const dateInput = interaction.options.getString('date');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Parse and validate date
  let sessionDate: Date;
  if (dateInput) {
    // Try to parse the date
    sessionDate = new Date(dateInput);
    
    // Check if date is valid
    if (isNaN(sessionDate.getTime())) {
      await interaction.editReply(
        `❌ Invalid date format. Please use:\n` +
        `• YYYY-MM-DD (e.g., 2025-11-09)\n` +
        `• MM/DD/YYYY (e.g., 11/09/2025)\n` +
        `• Or leave blank for today`
      );
      return;
    }
    
    // Check if date is in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (sessionDate > today) {
      await interaction.editReply(`❌ Session date cannot be in the future.`);
      return;
    }
  } else {
    // Use today if no date specified
    sessionDate = new Date();
  }

  // Optimized mentorship lookup (single query with joins)
  const { data, error } = await getMentorshipByDiscordIds({
    instructorDiscordId,
    menteeDiscordId: student.id,
    status: 'active'
  });

  if (error) {
    console.error('Mentorship lookup error:', error);
  }

  if (!data) {
    await interaction.editReply(`Could not find a mentorship record for ${student.tag}.`);
    return;
  }

  // Prevent going below zero
  const newCount = Math.max(0, data.sessions_remaining - 1);
  const { error: updateError } = await supabase
    .from('mentorships')
    .update({ 
      sessions_remaining: newCount,
      last_session_date: sessionDate.toISOString()
    })
    .eq('id', data.id);

  if (updateError) {
    console.error('Supabase error:', updateError);
    await interaction.editReply(`Failed to update ${student.tag}.`);
    return;
  }

  // Format date for display
  const dateDisplay = sessionDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  let message = `✅ ${student.tag} updated.\n\n`;
  message += `📊 **Remaining sessions:** ${newCount}/${data.total_sessions}\n`;
  message += `📅 **Last session:** ${dateDisplay}`;
  
  if (newCount === 0) {
    message += '\n\n⚠️ **All sessions used!**';
  }

  // Trigger testimonial request after 3rd session completed (when 1 remains)
  if (newCount === 1) {
    try {
      // Check if already requested or submitted
      const { data: mentorshipCheck } = await supabase
        .from('mentorships')
        .select('testimonial_requested_at, testimonial_submitted')
        .eq('id', data.id)
        .single();

      const alreadyRequested = Boolean(mentorshipCheck?.testimonial_requested_at);
      const alreadySubmitted = Boolean(mentorshipCheck?.testimonial_submitted);

      if (!alreadyRequested && !alreadySubmitted) {
        const menteeEmail = (data as any).mentees?.email || null;
        const instructorName = (data as any).instructors?.name || 'your instructor';

        if (menteeEmail) {
          const sent = await sendTestimonialRequest({
            menteeEmail: menteeEmail,
            menteeName: student.tag,
            instructorName: instructorName,
            sessionNumber: data.total_sessions - newCount
          });

          if (sent) {
            await supabase
              .from('mentorships')
              .update({ testimonial_requested_at: new Date().toISOString() })
              .eq('id', data.id);

            message += '\n\n📧 Testimonial request sent!';
          }
        }
      }
    } catch (e) {
      console.log('Testimonial request flow error:', e);
    }
  }

  await interaction.editReply(message);
}