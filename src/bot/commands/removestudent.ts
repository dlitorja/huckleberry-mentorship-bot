// src/bot/commands/removestudent.ts
// Admin-only command to remove a student's 1-on-1 Mentee role

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { removeStudentRole } from '../../utils/roleManagement.js';
import { CONFIG } from '../../config/constants.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { logger } from '../../utils/logger.js';

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

async function executeCommand(interaction: ChatInputCommandInteraction) {
  // Defer reply since this might take a moment
  await interaction.deferReply({ ephemeral: true });

  // Verify admin permission
  const adminId = CONFIG.DISCORD_ADMIN_ID;
  if (interaction.user.id !== adminId) {
    await interaction.editReply({
      content: '❌ This command is only available to administrators.'
    });
    return;
  }

  // Get command options
  const student = interaction.options.get('student', true).user!;
  const reason = (interaction.options.get('reason')?.value as string) || 'Mentorship ended';
  const sendGoodbye = interaction.options.get('send_goodbye')?.value !== false; // Default to true

  // Remove student role with performance monitoring
  const result = await measurePerformance(
    'removestudent.remove_role',
    async () => {
      return await removeStudentRole({
        menteeDiscordId: student.id,
        reason,
        sendGoodbyeDm: sendGoodbye,
        notifyAdmin: false, // Don't notify admin since they initiated this
        client: interaction.client
      });
    },
    { studentId: student.id, reason, sendGoodbye }
  );

  if (result.success) {
    let response = `✅ ${result.message}\n\n`;
    response += `**Reason:** ${reason}\n`;
    response += `**Goodbye DM:** ${sendGoodbye ? 'Sent' : 'Not sent'}\n\n`;
    response += `The mentorship has been marked as ended in the database.`;

    await interaction.editReply({ content: response });
    logger.info('Student removed successfully', { studentId: student.id, reason });
  } else {
    await interaction.editReply({
      content: `❌ ${result.message}\n\nPlease check the logs for more details.`
    });
    logger.error('Failed to remove student', new Error(result.message), {
      studentId: student.id,
      reason,
    });
  }
  return;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'removestudent',
  });
}

