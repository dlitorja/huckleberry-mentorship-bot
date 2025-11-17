// src/bot/commands/linkstudent.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG, getSupportContactString } from '../../config/constants.js';
import { executeWithErrorHandling, handleAsyncError } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { validateEmail } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('linkstudent')
  .setDescription('Admin only: Manually link a student\'s email to their Discord account')
  .addStringOption(option =>
    option
      .setName('email')
      .setDescription('The student\'s email address from their purchase')
      .setRequired(true)
  )
  .addUserOption(option =>
    option
      .setName('discorduser')
      .setDescription('The student\'s Discord account')
      .setRequired(true)
  );

async function executeCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Admin check
  const ADMIN_USER_ID = CONFIG.DISCORD_ADMIN_ID;
  
  if (!ADMIN_USER_ID) {
    await interaction.editReply('⚠️ Admin user ID is not configured.');
    return;
  }
  
  if (interaction.user.id !== ADMIN_USER_ID) {
    await interaction.editReply('⛔ This command is only available to administrators.');
    return;
  }

  // Validate and sanitize email
  const rawEmail = interaction.options.getString('email', true);
  let email: string;
  try {
    email = validateEmail(rawEmail, 'email');
  } catch (validationError) {
    await interaction.editReply(`❌ Invalid email format: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
    return;
  }

  const discordUser = interaction.options.getUser('discorduser', true);

  // Find pending join by email with performance monitoring
  const pendingJoin = await measurePerformance(
    'linkstudent.find_pending_join',
    async () => {
      const { data, error } = await supabase
        .from('pending_joins')
        .select('*, instructors(discord_id, name)')
        .eq('email', email)
        .is('discord_user_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        throw new Error(`No pending join found for email: ${email}`);
      }
      return data;
    },
    { email }
  );

  // Update pending join with Discord user ID
  await measurePerformance(
    'linkstudent.update_pending_join',
    async () => {
      const { error: updateError } = await supabase
        .from('pending_joins')
        .update({
          discord_user_id: discordUser.id,
          joined_at: new Date().toISOString()
        })
        .eq('id', pendingJoin.id);

      if (updateError) {
        throw new Error(`Failed to link student: ${updateError.message}`);
      }
    },
    { pendingJoinId: pendingJoin.id, discordUserId: discordUser.id }
  );

  // Find and assign the "1-on-1 Mentee" role
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply('❌ Could not access guild information.');
    return;
  }

  try {
    const member = await guild.members.fetch(discordUser.id);
    const role = guild.roles.cache.find(r => r.name === '1-on-1 Mentee');

    if (role) {
      await member.roles.add(role);
      logger.info('Manually assigned role to student', { 
        discordUserId: discordUser.id, 
        roleName: role.name 
      });
    } else {
      logger.warn('Could not find "1-on-1 Mentee" role', { guildId: guild.id });
    }

    // Send welcome DM to student (fire-and-forget)
    const instructorMention = (pendingJoin as any).instructors?.discord_id 
      ? `<@${(pendingJoin as any).instructors.discord_id}>` 
      : (pendingJoin as any).instructors?.name || 'your instructor';
      
    handleAsyncError(
      discordUser.send(
        `Welcome to the ${CONFIG.ORGANIZATION_NAME} Community! 🎉\n\n` +
        `You've been assigned the "1-on-1 Mentee" role -- this is needed so you can access the mentorship voice channels!\n\n` +
        `Your instructor is ${instructorMention}\n\n` +
        `Please inform them of your schedule so they can check their availability -- please include your time zone, as all our instructors and students are all over the world!\n\n` +
        `Your account has been manually linked by an admin.\n\n` +
        `Having any issues? ${getSupportContactString()}`
      ),
      { commandName: 'linkstudent', operation: 'send_welcome_dm', discordUserId: discordUser.id }
    );

    // Send notification to instructor (fire-and-forget)
    if ((pendingJoin as any).instructors?.discord_id) {
      handleAsyncError(
        (async () => {
          const instructor = await interaction.client.users.fetch((pendingJoin as any).instructors.discord_id);
          await instructor.send(
            `🎓 **New Mentee Assigned**\n\n` +
            `${discordUser} (${email}) has been manually linked to your mentorship program.\n\n` +
            `They're ready to get started!`
          );
        })(),
        { commandName: 'linkstudent', operation: 'send_instructor_notification', instructorId: (pendingJoin as any).instructors.discord_id }
      );
    }

    // Create mentorship record if it doesn't exist (fire-and-forget)
    handleAsyncError(
      measurePerformance(
        'linkstudent.create_mentorship',
        async () => {
          const { data: existingMentee } = await supabase
            .from('mentees')
            .select('id')
            .eq('discord_id', discordUser.id)
            .single();

          if (!existingMentee) {
            // Create mentee record
            const { data: newMentee, error: menteeError } = await supabase
              .from('mentees')
              .insert({
                discord_id: discordUser.id,
                email: email
              })
              .select('id')
              .single();

            if (!menteeError && newMentee) {
              // Check if mentorship exists
              const { data: existingMentorship } = await supabase
                .from('mentorships')
                .select('id')
                .eq('mentee_id', newMentee.id)
                .eq('instructor_id', pendingJoin.instructor_id)
                .single();

              if (!existingMentorship) {
                // Create mentorship record with default sessions
                await supabase
                  .from('mentorships')
                  .insert({
                    mentee_id: newMentee.id,
                    instructor_id: pendingJoin.instructor_id,
                    sessions_remaining: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE,
                    total_sessions: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE
                  });
                
                logger.info('Created mentorship record for manually linked student', {
                  menteeId: newMentee.id,
                  instructorId: pendingJoin.instructor_id,
                });
              }
            }
          }
        },
        { discordUserId: discordUser.id, email }
      ),
      { commandName: 'linkstudent', operation: 'create_mentorship' }
    );

    await interaction.editReply(
      `✅ **Successfully linked!**\n\n` +
      `📧 Email: ${email}\n` +
      `👤 Discord: ${discordUser.tag}\n` +
      `👨‍🏫 Instructor: ${(pendingJoin as any).instructors?.name || 'Unknown'}\n` +
      `🎭 Role: Assigned\n` +
      `💬 Welcome DM: Sent\n\n` +
      `The student is now fully set up!`
    );

}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'linkstudent',
  });
}

