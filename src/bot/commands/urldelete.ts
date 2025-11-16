import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('urldelete')
  .setDescription('Delete a short URL')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('The short code to delete')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Admin-only enforcement
    if (interaction.user.id !== process.env.DISCORD_ADMIN_ID) {
      await interaction.editReply('❌ This command is only available to administrators.');
      return;
    }

    const shortCode = interaction.options.getString('code', true);

    // Verify existence
    const { data: urlData, error: checkError } = await supabase
      .from('shortened_urls')
      .select('short_code')
      .eq('short_code', shortCode)
      .maybeSingle();

    if (checkError || !urlData) {
      await interaction.editReply(`❌ Short URL "${shortCode}" not found.`);
      return;
    }

    // Delete URL (cascade will delete analytics)
    const { error: deleteError } = await supabase
      .from('shortened_urls')
      .delete()
      .eq('short_code', shortCode);

    if (deleteError) {
      console.error('Failed to delete URL:', deleteError);
      await interaction.editReply('❌ Failed to delete URL. Please try again.');
      return;
    }

    await interaction.editReply(`✅ Short URL "${shortCode}" has been deleted.`);
  } catch (err) {
    console.error('urldelete command error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ An unexpected error occurred while deleting the URL.');
    }
  }
}


