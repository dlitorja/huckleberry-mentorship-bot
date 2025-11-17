// src/bot/commands/alertdelayed.ts
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';
import { notifyAdminError } from '../../utils/adminNotifications.js';

export const data = new SlashCommandBuilder()
  .setName('alertdelayed')
  .setDescription('Admin only: Check for and alert about students who haven\'t joined after 24 hours')
  .addIntegerOption(option =>
    option
      .setName('hours')
      .setDescription('Alert for joins older than X hours (default: 24)')
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

  const hours = interaction.options.getInteger('hours') || 24;
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);
  const cutoffDateStr = cutoffDate.toISOString();

  // Fetch pending joins older than cutoff
  const { data: delayedJoins, error } = await supabase
    .from('pending_joins')
    .select('email, created_at, instructors(name, discord_id)')
    .is('joined_at', null)
    .lte('created_at', cutoffDateStr)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching delayed joins:', error);
    await interaction.editReply('Failed to fetch delayed joins.');
    return;
  }

  if (!delayedJoins || delayedJoins.length === 0) {
    await interaction.editReply(`✅ No delayed joins! All purchases within the last ${hours} hours have joined.`);
    return;
  }

  // Send individual alert DMs to admin for each delayed join
  let alertsSent = 0;
  type DelayedJoin = { email: string; created_at: string; instructors?: { name?: string | null; discord_id?: string | null } | null };
  for (const join of (delayedJoins as DelayedJoin[])) {
    const createdAt = new Date(join.created_at);
    const hoursSince = Math.floor((new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    
    await notifyAdminError({
      type: 'webhook_error',
      message: `Student hasn't joined after ${hoursSince} hours`,
      details: `Email: ${join.email}\nInstructor: ${join.instructors?.name ?? 'Unknown'}\nPurchase Date: ${createdAt.toLocaleString()}\n\nConsider following up with this student!`,
      studentEmail: join.email
    });
    
    alertsSent++;
  }

  await interaction.editReply(
    `⚠️ Found ${delayedJoins.length} delayed join(s) older than ${hours} hours.\n\n` +
    `${alertsSent} alert(s) sent to admin DM with details.`
  );
}

