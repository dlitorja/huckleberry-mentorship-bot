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

  type PendingJoinWithInstructor = {
    id: string;
    email: string;
    instructor_id: string;
    discord_user_id: string | null;
    created_at: string;
    joined_at: string | null;
    instructors: { discord_id: string | null; name: string | null } | null;
  };

  // Find pending join by email with instructor data in a single query
  const pendingJoin = await measurePerformance(
    'linkstudent.find_pending_join',
    async () => {
      const { data, error } = await supabase
        .from('pending_joins')
        .select(`
          *,
          instructors!pending_joins_instructor_id_fkey(discord_id, name)
        `)
        .eq('email', email)
        .is('discord_user_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        throw new Error(`No pending join found for email: ${email}`);
      }
      return data as PendingJoinWithInstructor;
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
    const instructorMention = pendingJoin.instructors?.discord_id 
      ? `<@${pendingJoin.instructors.discord_id}>` 
      : pendingJoin.instructors?.name || 'your instructor';
      
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
    const instructorDiscordId = pendingJoin.instructors?.discord_id;
    if (instructorDiscordId) {
      handleAsyncError(
        (async () => {
          const instructor = await interaction.client.users.fetch(instructorDiscordId);
          await instructor.send(
            `🎓 **New Mentee Assigned**\n\n` +
            `${discordUser} (${email}) has been manually linked to your mentorship program.\n\n` +
            `They're ready to get started!`
          );
        })(),
        { commandName: 'linkstudent', operation: 'send_instructor_notification', instructorId: instructorDiscordId }
      );
    }

    // Create mentorship record if it doesn't exist (fire-and-forget)
    handleAsyncError(
      measurePerformance(
        'linkstudent.create_mentorship',
        async () => {
          // Check for existing mentee and mentorship in a single query
          const { data: existingMentee, error: menteeError } = await supabase
            .from('mentees')
            .select(`
              id,
              mentorships!mentees_mentee_id_fkey(id)
            `)
            .eq('discord_id', discordUser.id)
            .eq('mentorships.instructor_id', pendingJoin.instructor_id)
            .maybeSingle();

          if (menteeError && menteeError.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw new Error(`Failed to check existing mentee: ${menteeError.message}`);
          }

          if (!existingMentee) {
            // Create mentee record
            const { data: newMentee, error: createMenteeError } = await supabase
              .from('mentees')
              .insert({
                discord_id: discordUser.id,
                email: email
              })
              .select('id')
              .single();

            if (createMenteeError || !newMentee) {
              throw new Error(`Failed to create mentee: ${createMenteeError?.message || 'Unknown error'}`);
            }

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
          } else {
            // Mentee exists, check if mentorship exists
            type MenteeWithMentorships = {
              id: string;
              mentorships: { id: string }[] | null;
            };
            const existingMentorships = (existingMentee as MenteeWithMentorships).mentorships || [];
            if (existingMentorships.length === 0) {
              // Create mentorship record with default sessions
              await supabase
                .from('mentorships')
                .insert({
                  mentee_id: existingMentee.id,
                  instructor_id: pendingJoin.instructor_id,
                  sessions_remaining: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE,
                  total_sessions: CONFIG.DEFAULT_SESSIONS_PER_PURCHASE
                });
              
              logger.info('Created mentorship record for existing mentee', {
                menteeId: existingMentee.id,
                instructorId: pendingJoin.instructor_id,
              });
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
      `👨‍🏫 Instructor: ${pendingJoin.instructors?.name || 'Unknown'}\n` +
      `🎭 Role: Assigned\n` +
      `💬 Welcome DM: Sent\n\n` +
      `The student is now fully set up!`
    );
  } catch (error) {
    logger.error('Error in linkstudent command', error instanceof Error ? error : new Error(String(error)), {
      email,
      discordUserId: discordUser.id,
    });
    await interaction.editReply('❌ An error occurred while linking the student. Please check the logs.');
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'linkstudent',
  });
}

