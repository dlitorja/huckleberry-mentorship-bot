// src/bot/commands/removestudent.ts
// Admin-only command to remove a student's 1-on-1 Mentee role

import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { removeStudentRole } from '../../utils/roleManagement.js';

export const data = new SlashCommandBuilder()
  .setName('removestudent')
  .setDescription('Remove a student\'s 1-on-1 Mentee role (Admin only)')
  .addUserOption(option =>
    option
      .setName('student')
      .setDescription('The student to remove')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for removal (e.g., "Completed mentorship", "Refunded")')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('send_goodbye')
      .setDescription('Send a goodbye DM to the student? (default: true)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction) {
  // Defer reply since this might take a moment
  await interaction.deferReply({ ephemeral: true });

  try {
    // Verify admin permission
    const adminId = process.env.DISCORD_ADMIN_ID;
    if (interaction.user.id !== adminId) {
      return await interaction.editReply({
        content: '❌ This command is only available to administrators.'
      });
    }

    // Get command options
    const student = interaction.options.get('student', true).user!;
    const reason = (interaction.options.get('reason')?.value as string) || 'Mentorship ended';
    const sendGoodbye = interaction.options.get('send_goodbye')?.value !== false; // Default to true

    // Remove student role
    const result = await removeStudentRole({
      menteeDiscordId: student.id,
      reason,
      sendGoodbyeDm: sendGoodbye,
      notifyAdmin: false, // Don't notify admin since they initiated this
      client: interaction.client
    });

    if (result.success) {
      let response = `✅ ${result.message}\n\n`;
      response += `**Reason:** ${reason}\n`;
      response += `**Goodbye DM:** ${sendGoodbye ? 'Sent' : 'Not sent'}\n\n`;
      response += `The mentorship has been marked as ended in the database.`;

      await interaction.editReply({ content: response });
    } else {
      await interaction.editReply({
        content: `❌ ${result.message}\n\nPlease check the logs for more details.`
      });
    }

  } catch (error) {
    console.error('Error in removestudent command:', error);
    await interaction.editReply({
      content: '❌ An unexpected error occurred while removing the student. Please check the logs.'
    });
  }
}

