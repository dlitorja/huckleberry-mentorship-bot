import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { validateNonEmptyString } from '../../utils/validation.js';

export const data = new SlashCommandBuilder()
  .setName('urldelete')
  .setDescription('Delete a short URL')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('The short code to delete')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function executeCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Admin-only enforcement
  if (interaction.user.id !== CONFIG.DISCORD_ADMIN_ID) {
    await interaction.editReply('❌ This command is only available to administrators.');
    return;
  }

  const shortCodeInput = interaction.options.getString('code', true);
  const shortCode = validateNonEmptyString(shortCodeInput, 'code', 20);

  // Verify existence with performance monitoring
  await measurePerformance(
    'urldelete.verify_existence',
    async () => {
      const { data, error } = await supabase
        .from('shortened_urls')
        .select('short_code')
        .eq('short_code', shortCode)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to check URL existence: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Short URL "${shortCode}" not found`);
      }
    },
    { shortCode }
  );

  // Delete URL (cascade will delete analytics) with performance monitoring
  await measurePerformance(
    'urldelete.delete_url',
    async () => {
      const { error: deleteError } = await supabase
        .from('shortened_urls')
        .delete()
        .eq('short_code', shortCode);

      if (deleteError) {
        throw new Error(`Failed to delete URL: ${deleteError.message}`);
      }
    },
    { shortCode }
  );

  await interaction.editReply(`✅ Short URL "${shortCode}" has been deleted.`);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'urldelete',
  });
}


