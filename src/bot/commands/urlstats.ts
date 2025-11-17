import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { validateNonEmptyString } from '../../utils/validation.js';

export const data = new SlashCommandBuilder()
  .setName('urlstats')
  .setDescription('View analytics for a short URL')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('The short code (e.g., abc123)')
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

  // Get URL info with performance monitoring
  const urlData = await measurePerformance(
    'urlstats.fetch_url',
    async () => {
      const { data, error } = await supabase
        .from('shortened_urls')
        .select('original_url, click_count, created_at, last_clicked_at, description')
        .eq('short_code', shortCode)
        .single();

      if (error || !data) {
        throw new Error(`Short URL "${shortCode}" not found`);
      }
      return data;
    },
    { shortCode }
  );

  // Fetch all analytics data in a single query (fixes N+1 issue) with performance monitoring
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { allClicks, totalClicks } = await measurePerformance(
    'urlstats.fetch_analytics',
    async () => {
      const { data, count } = await supabase
        .from('url_analytics')
        .select('clicked_at, device_type, browser', { count: 'exact' })
        .eq('short_code', shortCode)
        .order('clicked_at', { ascending: false });

      if (!data) {
        throw new Error('Failed to fetch analytics data');
      }
      return { allClicks: data, totalClicks: count || 0 };
    },
    { shortCode }
  );

  // Process data in memory
  const recentClicks = (allClicks || []).slice(0, 10); // Top 10 most recent
  
  const deviceCounts: Record<string, number> = {};
  let recentClicksCount = 0;
  
  (allClicks || []).forEach(click => {
    // Device breakdown
    const device = (click as { device_type?: string }).device_type || 'unknown';
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    
    // Count recent clicks (last 7 days)
    const clickedAt = new Date((click as { clicked_at: string }).clicked_at);
    if (clickedAt >= sevenDaysAgo) {
      recentClicksCount++;
    }
  });

    const baseUrl = process.env.SHORT_URL_BASE || `https://${process.env.FLY_APP_NAME || 'your-app'}.fly.dev`;
    const shortUrl = `${baseUrl}/${shortCode}`;

    const embed = new EmbedBuilder()
      .setTitle('📊 URL Analytics')
      .setDescription(`**Short URL:** ${shortUrl}`)
      .addFields(
        { name: '🔗 Original URL', value: urlData.original_url.substring(0, 100) + (urlData.original_url.length > 100 ? '...' : ''), inline: false },
        { name: '👆 Total Clicks', value: String(totalClicks || 0), inline: true },
        { name: '📅 Created', value: new Date(urlData.created_at).toLocaleDateString(), inline: true },
        { name: '🕐 Last Click', value: urlData.last_clicked_at ? new Date(urlData.last_clicked_at).toLocaleString() : 'Never', inline: true },
        { name: '📈 Last 7 Days', value: String(recentClicksCount || 0), inline: true }
      )
      .setColor(0x5865F2)
      .setTimestamp();

    if (Object.keys(deviceCounts).length > 0) {
      const deviceBreakdownText = Object.entries(deviceCounts)
        .map(([device, count]) => `${device}: ${count}`)
        .join('\n');
      embed.addFields({ name: '📱 Device Breakdown', value: deviceBreakdownText, inline: false });
    }

    if (recentClicks && recentClicks.length > 0) {
      const recentClicksText = recentClicks
        .slice(0, 5)
        .map(click => {
          const clickData = click as { clicked_at: string; device_type?: string; browser?: string };
          return `• ${new Date(clickData.clicked_at).toLocaleString()} - ${clickData.device_type || 'unknown'} (${clickData.browser || 'unknown'})`;
        })
        .join('\n');
      embed.addFields({ name: '🕐 Recent Clicks', value: recentClicksText || 'None', inline: false });
    }

  await interaction.editReply({ embeds: [embed] });
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'urlstats',
  });
}


