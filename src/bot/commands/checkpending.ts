// src/bot/commands/checkpending.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';

export const data = new SlashCommandBuilder()
  .setName('checkpending')
  .setDescription('Admin only: Check students who purchased but haven\'t joined Discord yet');

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

  // Fetch pending joins
  const { data: pendingJoins, error } = await supabase
    .from('pending_joins')
    .select('email, created_at, instructor_id, discord_user_id, joined_at, instructors(name)')
    .is('joined_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending joins:', error);
    await interaction.editReply('Failed to fetch pending joins.');
    return;
  }

  if (!pendingJoins || pendingJoins.length === 0) {
    await interaction.editReply('✅ No pending joins! All students have joined Discord.');
    return;
  }

  // Calculate time since purchase
  const now = new Date();
  type PendingJoin = { email: string; created_at: string; instructors?: { name?: string | null } | null };
  type PendingJoinWithTime = PendingJoin & { hoursSince: number };
  const pendingWithTime: PendingJoinWithTime[] = (pendingJoins as PendingJoin[]).map((join) => {
    const createdAt = new Date(join.created_at);
    const hoursSince = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    return {
      ...join,
      hoursSince
    };
  });

  // Create embed with pending joins
  const embed = new EmbedBuilder()
    .setTitle('⏳ Pending Discord Joins')
    .setDescription(`${pendingJoins.length} student(s) purchased but haven't joined Discord yet`)
    .setColor(0xFFA500)
    .setTimestamp();

  // Add fields for each pending join
  pendingWithTime.forEach((join, index: number) => {
    if (index < 25) { // Discord embed limit is 25 fields
      const timeWarning = join.hoursSince > 24 ? '⚠️ ' : '';
      embed.addFields({
        name: `${timeWarning}${join.email}`,
        value: `👨‍🏫 Instructor: ${join.instructors?.name || 'Unknown'}\n⏱️ ${join.hoursSince} hours ago\n📅 ${new Date(join.created_at).toLocaleString()}`,
        inline: false
      });
    }
  });

  if (pendingJoins.length > 25) {
    embed.setFooter({ text: `Showing 25 of ${pendingJoins.length} pending joins` });
  }

  await interaction.editReply({ embeds: [embed] });
}

