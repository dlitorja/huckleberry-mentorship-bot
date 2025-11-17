// src/bot/commands/session.ts

import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { sendTestimonialRequest } from '../../utils/testimonialRequest.js';
import { getMentorshipByDiscordIds, type MentorshipWithRelations } from '../../utils/mentorship.js';
import { executeWithErrorHandling, handleAsyncError } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { validateDate } from '../../utils/validation.js';

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

async function executeCommand(interaction: ChatInputCommandInteraction) {
  const student = interaction.options.getUser('student', true);
  const instructorDiscordId = interaction.user.id;
  const dateInput = interaction.options.getString('date');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Parse and validate date
  let sessionDate: Date;
  if (dateInput) {
    try {
      sessionDate = validateDate(dateInput, 'date', false); // false = don't allow future dates
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
    // Use today if no date specified
    sessionDate = new Date();
  }

  // Optimized mentorship lookup with performance monitoring
  const mentorshipData = await measurePerformance(
    'session.mentorship_lookup',
    async () => {
      const { data, error } = await getMentorshipByDiscordIds({
        instructorDiscordId,
        menteeDiscordId: student.id,
        status: 'active'
      });

      if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Mentorship lookup failed: ${errorMessage}`);
      }

      if (!data) {
        throw new Error(`Could not find a mentorship record for ${student.tag}`);
      }

      return data;
    },
    { instructorDiscordId, menteeDiscordId: student.id }
  );

  // Prevent going below zero
  const newCount = Math.max(0, mentorshipData.sessions_remaining - 1);
  
  // Update sessions with performance monitoring
  await measurePerformance(
    'session.update_sessions',
    async () => {
      const { error: updateError } = await supabase
        .from('mentorships')
        .update({ 
          sessions_remaining: newCount,
          last_session_date: sessionDate.toISOString()
        })
        .eq('id', mentorshipData.id);

      if (updateError) {
        throw new Error(`Failed to update sessions: ${updateError.message}`);
      }
    },
    { mentorshipId: mentorshipData.id, newCount }
  );

  // Format date for display
  const dateDisplay = sessionDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  let message = `✅ ${student.tag} updated.\n\n`;
  message += `📊 **Remaining sessions:** ${newCount}/${mentorshipData.total_sessions}\n`;
  message += `📅 **Last session:** ${dateDisplay}`;
  
  if (newCount === 0) {
    message += '\n\n⚠️ **All sessions used!**';
  }

  // Trigger testimonial request after 3rd session completed (when 1 remains)
  if (newCount === 1) {
    // Check if already requested or submitted (fire-and-forget)
    handleAsyncError(
      measurePerformance(
        'session.testimonial_request',
        async () => {
          const { data: mentorshipCheck } = await supabase
            .from('mentorships')
            .select('testimonial_requested_at, testimonial_submitted')
            .eq('id', mentorshipData.id)
            .single();

          const alreadyRequested = Boolean(mentorshipCheck?.testimonial_requested_at);
          const alreadySubmitted = Boolean(mentorshipCheck?.testimonial_submitted);

          if (!alreadyRequested && !alreadySubmitted) {
            const mentorshipWithRelations = mentorshipData as MentorshipWithRelations;
            const menteeEmail = mentorshipWithRelations.mentees?.email || null;
            const instructorName = mentorshipWithRelations.instructors?.name || 'your instructor';

            if (menteeEmail) {
              const sent = await sendTestimonialRequest({
                menteeEmail: menteeEmail,
                menteeName: student.tag,
                instructorName: instructorName,
                sessionNumber: mentorshipData.total_sessions - newCount
              });

              if (sent) {
                await supabase
                  .from('mentorships')
                  .update({ testimonial_requested_at: new Date().toISOString() })
                  .eq('id', mentorshipData.id);

                message += '\n\n📧 Testimonial request sent!';
              }
            }
          }

          // Append renewal notice to the command reply
          message += '\n\nℹ️ Your mentorship renews automatically one month from your original purchase.' +
            ' To pause or cancel before renewal, email huckleberryartinc@gmail.com.';

          // Send a friendly DM to the student (fire-and-forget)
          handleAsyncError(
            student.send(
              `Hi ${student.username}! You're on your last session for this cycle. ` +
              `Your mentorship will renew automatically one month from your original purchase. ` +
              `If you'd like to pause or cancel instead, please do so before the renewal. ` +
              `Questions? Email us at huckleberryartinc@gmail.com.`
            ),
            { commandName: 'session', operation: 'send_renewal_dm', studentId: student.id }
          );
        },
        { mentorshipId: mentorshipData.id, newCount }
      ),
      { commandName: 'session', operation: 'testimonial_request' }
    );
  }

  await interaction.editReply(message);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'session',
  });
}