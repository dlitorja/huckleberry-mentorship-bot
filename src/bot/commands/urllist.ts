import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { validatePositiveInteger } from '../../utils/validation.js';
import type { ShortenedUrl } from '../../types/database.js';

export const data = new SlashCommandBuilder()
  .setName('urllist')
  .setDescription('List all your shortened URLs')
  .addIntegerOption(option =>
    option.setName('page')
      .setDescription('Page number (default: 1)')
      .setRequired(false)
      .setMinValue(1)
  )
  .addIntegerOption(option =>
    option.setName('per_page')
      .setDescription('Items per page (default: 10, max: 25)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function executeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch {
      return;
    }
  }

  // Admin-only enforcement
  if (interaction.user.id !== CONFIG.DISCORD_ADMIN_ID) {
    await interaction.editReply('❌ This command is only available to administrators.');
    return;
  }

  const pageInput = interaction.options.getInteger('page') || 1;
  const perPageInput = interaction.options.getInteger('per_page') || 10;
  const page = validatePositiveInteger(pageInput, 'page', 1);
  const perPage = validatePositiveInteger(perPageInput, 'per_page', 1, 25);
  const offset = (page - 1) * perPage;

  // Get URLs (global list for admin) with count for pagination with performance monitoring
  const { urls, count } = await measurePerformance(
    'urllist.fetch_urls',
    async () => {
      const { data, error, count: urlCount } = await supabase
        .from('shortened_urls')
        .select('short_code, original_url, click_count, created_at, description', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + perPage - 1);

      if (error) {
        throw new Error(`Failed to fetch URLs: ${error.message}`);
      }
      return { urls: data || [], count: urlCount || 0 };
    },
    { page, perPage }
  );

  if (!urls || urls.length === 0) {
    await interaction.editReply('📝 You haven\'t created any short URLs yet. Use `/shortenurl` to create one!');
    return;
  }

  const baseUrl = process.env.SHORT_URL_BASE || `https://${process.env.FLY_APP_NAME || 'your-app'}.fly.dev`;

  const totalPages = count ? Math.ceil(count / perPage) : 1;
  const embed = new EmbedBuilder()
    .setTitle('🔗 Your Shortened URLs')
    .setDescription(
      totalPages > 1 
        ? `Page ${page} of ${totalPages} (${count || 0} total URLs)`
        : `Page ${page}`
    )
    .setColor(0x5865F2)
    .setTimestamp();

  urls.forEach(url => {
    const urlData = url as ShortenedUrl;
    const shortUrl = `${baseUrl}/${urlData.short_code}`;
    const original = urlData.original_url.length > 50 
      ? urlData.original_url.substring(0, 50) + '...' 
      : urlData.original_url;
    
    embed.addFields({
      name: `/${urlData.short_code}`,
      value: `🔗 [${original}](${shortUrl})\n👆 ${urlData.click_count} clicks\n📅 ${new Date(urlData.created_at).toLocaleDateString()}`,
      inline: false
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'urllist',
  });
}


