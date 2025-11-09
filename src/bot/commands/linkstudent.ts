// src/bot/commands/linkstudent.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

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

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Admin check
  const ADMIN_USER_ID = process.env.DISCORD_ADMIN_ID;
  
  if (!ADMIN_USER_ID) {
    await interaction.editReply('⚠️ Admin user ID is not configured.');
    return;
  }
  
  if (interaction.user.id !== ADMIN_USER_ID) {
    await interaction.editReply('⛔ This command is only available to administrators.');
    return;
  }

  const email = interaction.options.getString('email', true).toLowerCase();
  const discordUser = interaction.options.getUser('discorduser', true);

  // Find pending join by email
  const { data: pendingJoin, error: findError } = await supabase
    .from('pending_joins')
    .select('*, instructors(discord_id, name)')
    .eq('email', email)
    .is('discord_user_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (findError || !pendingJoin) {
    await interaction.editReply(
      `❌ No pending join found for email: ${email}\n\n` +
      `This could mean:\n` +
      `• The email doesn't match any purchase\n` +
      `• The student has already been linked\n` +
      `• The email was typed incorrectly`
    );
    return;
  }

  // Update pending join with Discord user ID
  const { error: updateError } = await supabase
    .from('pending_joins')
    .update({
      discord_user_id: discordUser.id,
      joined_at: new Date().toISOString()
    })
    .eq('id', pendingJoin.id);

  if (updateError) {
    console.error('Failed to link student:', updateError);
    await interaction.editReply(`❌ Failed to link student. Database error: ${updateError.message}`);
    return;
  }

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
      console.log(`✅ Manually assigned "1-on-1 Mentee" role to ${discordUser.tag}`);
    } else {
      console.error('Could not find "1-on-1 Mentee" role');
    }

    // Send welcome DM to student
    try {
      const instructorMention = (pendingJoin as any).instructors?.discord_id 
        ? `<@${(pendingJoin as any).instructors.discord_id}>` 
        : (pendingJoin as any).instructors?.name || 'your instructor';
        
      await discordUser.send(
        `Welcome to the Huckleberry Art Community! 🎉\n\n` +
        `You've been assigned the "1-on-1 Mentee" role -- this is needed so you can access the mentorship voice channels!\n\n` +
        `Your instructor is ${instructorMention}\n\n` +
        `Please inform them of your schedule so they can check their availability -- please include your time zone, as all our instructors and students are all over the world!\n\n` +
        `Your account has been manually linked by an admin.\n\n` +
        `Having any issues? Email us at huckleberryartinc@gmail.com or send a DM to Dustin (<@184416083984384005>)`
      );
      console.log('✅ Welcome DM sent to manually linked student');
    } catch (dmError) {
      console.log('Could not send DM to student:', dmError);
    }

    // Send notification to instructor
    if ((pendingJoin as any).instructors?.discord_id) {
      try {
        const instructor = await interaction.client.users.fetch((pendingJoin as any).instructors.discord_id);
        await instructor.send(
          `🎓 **New Mentee Assigned**\n\n` +
          `${discordUser} (${email}) has been manually linked to your mentorship program.\n\n` +
          `They're ready to get started!`
        );
        console.log('✅ Notification sent to instructor');
      } catch (instructorDmError) {
        console.log('Could not send DM to instructor:', instructorDmError);
      }
    }

    // Create mentorship record if it doesn't exist
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
          // Create mentorship record with default sessions (you can adjust this)
          await supabase
            .from('mentorships')
            .insert({
              mentee_id: newMentee.id,
              instructor_id: pendingJoin.instructor_id,
              sessions_remaining: 4,  // Default, adjust as needed
              total_sessions: 4
            });
          
          console.log('✅ Created mentorship record for manually linked student');
        }
      }
    }

    await interaction.editReply(
      `✅ **Successfully linked!**\n\n` +
      `📧 Email: ${email}\n` +
      `👤 Discord: ${discordUser.tag}\n` +
      `👨‍🏫 Instructor: ${(pendingJoin as any).instructors?.name || 'Unknown'}\n` +
      `🎭 Role: Assigned\n` +
      `💬 Welcome DM: Sent\n\n` +
      `The student is now fully set up!`
    );

  } catch (error) {
    console.error('Error in manual linking:', error);
    await interaction.editReply(`❌ An error occurred: ${error}`);
  }
}

