// src/bot/commands/dailysummary.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';

interface PendingJoin {
  id: string;
  email: string;
  created_at: string;
  joined_at: string | null;
  instructors: { name: string } | null;
}

interface InstructorStats {
  purchases: number;
  joined: number;
}

export const data = new SlashCommandBuilder()
  .setName('dailysummary')
  .setDescription('Admin only: Get daily summary of purchases and joins')
  .addIntegerOption(option =>
    option
      .setName('days')
      .setDescription('Number of days to look back (default: 1)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
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

  const days = interaction.options.getInteger('days') || 1;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  // Get purchases in the time period
  const { data: allPurchases, error: purchaseError } = await supabase
    .from('pending_joins')
    .select('id, email, created_at, joined_at, instructors(name)')
    .gte('created_at', startDateStr)
    .order('created_at', { ascending: false });

  if (purchaseError) {
    console.error('Error fetching purchases:', purchaseError);
    await interaction.editReply('Failed to fetch purchase data.');
    return;
  }

  // Calculate stats
  const purchases = (allPurchases || []) as PendingJoin[];
  const totalPurchases = purchases.length;
  const successfulJoins = purchases.filter((p) => p.joined_at !== null).length;
  const pendingJoins = totalPurchases - successfulJoins;
  const joinRate = totalPurchases > 0 ? Math.round((successfulJoins / totalPurchases) * 100) : 0;

  // Group by instructor
  const byInstructor = purchases.reduce((acc: Record<string, InstructorStats>, join) => {
    const instructor = join.instructors?.name || 'Unknown';
    if (!acc[instructor]) {
      acc[instructor] = { purchases: 0, joined: 0 };
    }
    acc[instructor].purchases += 1;
    if (join.joined_at) {
      acc[instructor].joined += 1;
    }
    return acc;
  }, {});

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${days}-Day Summary`)
    .setDescription(`Summary of purchases and joins over the last ${days} day(s)`)
    .setColor(0x5865F2)
    .addFields(
      { name: '🛒 Total Purchases', value: String(totalPurchases), inline: true },
      { name: '✅ Successful Joins', value: String(successfulJoins), inline: true },
      { name: '⏳ Pending Joins', value: String(pendingJoins), inline: true },
      { name: '📈 Join Rate', value: `${joinRate}%`, inline: true }
    )
    .setTimestamp();

  // Add breakdown by instructor
  if (byInstructor && Object.keys(byInstructor).length > 0) {
    let instructorBreakdown = '';
    for (const [instructor, stats] of Object.entries(byInstructor)) {
      instructorBreakdown += `**${instructor}:** ${stats.purchases} purchases, ${stats.joined} joined\n`;
    }
    embed.addFields({ name: '👨‍🏫 By Instructor', value: instructorBreakdown || 'None', inline: false });
  }

  // Add recent activity
  if (purchases.length > 0) {
    const recentActivity = purchases.slice(0, 5).map((join) => {
      const status = join.joined_at ? '✅' : '⏳';
      const time = new Date(join.created_at).toLocaleString();
      return `${status} ${join.email} - ${time}`;
    }).join('\n');
    
    embed.addFields({ 
      name: '🕐 Recent Activity (Last 5)', 
      value: recentActivity || 'None', 
      inline: false 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

