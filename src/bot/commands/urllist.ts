import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('urllist')
  .setDescription('List all your shortened URLs')
  .addIntegerOption(option =>
    option.setName('page')
      .setDescription('Page number (default: 1)')
      .setRequired(false)
      .setMinValue(1)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch {
      return;
    }
  }

  try {
    // Admin-only enforcement
    if (interaction.user.id !== process.env.DISCORD_ADMIN_ID) {
      await interaction.editReply('❌ This command is only available to administrators.');
      return;
    }

    const page = interaction.options.getInteger('page') || 1;
    const perPage = 10;
    const offset = (page - 1) * perPage;

    // Get URLs (global list for admin)
    const { data: urls, error } = await supabase
      .from('shortened_urls')
      .select('short_code, original_url, click_count, created_at, description')
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) {
      await interaction.editReply('❌ Failed to fetch URLs.');
      return;
    }

    if (!urls || urls.length === 0) {
      await interaction.editReply('📝 You haven\'t created any short URLs yet. Use `/shortenurl` to create one!');
      return;
    }

    const baseUrl = process.env.SHORT_URL_BASE || `https://${process.env.FLY_APP_NAME || 'your-app'}.fly.dev`;

    const embed = new EmbedBuilder()
      .setTitle('🔗 Your Shortened URLs')
      .setDescription(`Page ${page}`)
      .setColor(0x5865F2)
      .setTimestamp();

    urls.forEach(url => {
      const shortUrl = `${baseUrl}/${(url as any).short_code}`;
      const original = (url as any).original_url.length > 50 
        ? (url as any).original_url.substring(0, 50) + '...' 
        : (url as any).original_url;
      
      embed.addFields({
        name: `/${(url as any).short_code}`,
        value: `🔗 [${original}](${shortUrl})\n👆 ${(url as any).click_count} clicks\n📅 ${new Date((url as any).created_at).toLocaleDateString()}`,
        inline: false
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('urllist command error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ An unexpected error occurred while listing URLs.');
    }
  }
}


