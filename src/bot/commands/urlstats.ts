import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('urlstats')
  .setDescription('View analytics for a short URL')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('The short code (e.g., abc123)')
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

    // Get URL info
    const { data: urlData, error: urlError } = await supabase
      .from('shortened_urls')
      .select('original_url, click_count, created_at, last_clicked_at, description')
      .eq('short_code', shortCode)
      .single();

    if (urlError || !urlData) {
      await interaction.editReply(`❌ Short URL "${shortCode}" not found.`);
      return;
    }

    // Get click statistics
    const { count: totalClicks } = await supabase
      .from('url_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('short_code', shortCode);

    // Get recent clicks
    const { data: recentClicks } = await supabase
      .from('url_analytics')
      .select('clicked_at, device_type, browser')
      .eq('short_code', shortCode)
      .order('clicked_at', { ascending: false })
      .limit(10);

    // Get device breakdown
    const { data: deviceBreakdown } = await supabase
      .from('url_analytics')
      .select('device_type')
      .eq('short_code', shortCode);

    const deviceCounts: Record<string, number> = {};
    deviceBreakdown?.forEach(click => {
      const device = (click as any).device_type || 'unknown';
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });

    // Calculate clicks in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: recentClicksCount } = await supabase
      .from('url_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('short_code', shortCode)
      .gte('clicked_at', sevenDaysAgo.toISOString());

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
        .map(click => `• ${new Date((click as any).clicked_at).toLocaleString()} - ${(click as any).device_type || 'unknown'} (${(click as any).browser || 'unknown'})`)
        .join('\n');
      embed.addFields({ name: '🕐 Recent Clicks', value: recentClicksText || 'None', inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('urlstats command error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ An unexpected error occurred while fetching URL stats.');
    }
  }
}


