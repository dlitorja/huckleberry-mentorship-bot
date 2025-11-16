// src/utils/roleManagement.ts
// Shared utility functions for Discord role management

import { Client } from 'discord.js';
import { supabase } from '../bot/supabaseClient.js';
import { notifyAdminError } from './adminNotifications.js';
import { CONFIG, getSupportContactString } from '../config/constants.js';

type DiscordDmChannel = { id?: string };
type DiscordRole = { id?: string; name?: string };

let cachedRoleIds: Record<string, string> = {};
async function getRoleIdByName(roleName: string): Promise<string | null> {
  if (cachedRoleIds[roleName]) return cachedRoleIds[roleName];
  try {
    const rolesResponse = await fetch(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/roles`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );
    const roles: DiscordRole[] = await rolesResponse.json();
    const role = roles.find((r) => r && r.name === roleName);
    if (role?.id) {
      cachedRoleIds[roleName] = role.id;
      return cachedRoleIds[roleName];
    }
  } catch (err) {
    console.error('Failed to fetch Discord roles:', err);
  }
  return null;
}

interface RemoveStudentOptions {
  menteeDiscordId: string;
  reason?: string;
  sendGoodbyeDm?: boolean;
  notifyAdmin?: boolean;
  client?: Client;
  roleName?: string; // dynamic role removal (default "1-on-1 Mentee")
}

interface RemoveStudentResult {
  success: boolean;
  message: string;
  error?: unknown;
}

/**
 * Removes the "1-on-1 Mentee" role from a student and updates their mentorship status
 */
export async function removeStudentRole(options: RemoveStudentOptions): Promise<RemoveStudentResult> {
  const { menteeDiscordId, reason = 'Mentorship ended', sendGoodbyeDm = true, notifyAdmin = true, client, roleName = '1-on-1 Mentee' } = options;

  try {
    // Get mentee data from database
    const { data: menteeData, error: menteeError } = await supabase
      .from('mentees')
      .select('id, email, discord_id')
      .eq('discord_id', menteeDiscordId)
      .single();

    if (menteeError || !menteeData) {
      return {
        success: false,
        message: 'Student not found in database',
        error: menteeError
      };
    }

    // Update mentorship status to 'ended'
    const { error: updateError } = await supabase
      .from('mentorships')
      .update({ 
        status: 'ended',
        ended_at: new Date().toISOString(),
        end_reason: reason
      })
      .eq('mentee_id', menteeData.id);

    if (updateError) {
      console.error('Failed to update mentorship status:', updateError);
    }

    // Remove Discord role
    const roleRemoved = await removeDiscordRole(menteeDiscordId, roleName, client);

    if (!roleRemoved) {
      return {
        success: false,
        message: 'Failed to remove Discord role - student may have already left the server'
      };
    }

    // Send goodbye DM (optional)
    if (sendGoodbyeDm && client) {
      await sendGoodbyeDM(menteeDiscordId, reason);
    }

    // Notify admin (optional)
    if (notifyAdmin) {
      await notifyAdminRoleRemoval(menteeData.email, menteeDiscordId, reason);
    }

    return {
      success: true,
      message: `Successfully removed ${roleName} role from <@${menteeDiscordId}>`
    };

  } catch (error) {
    console.error('Error removing student role:', error);
    
    if (notifyAdmin) {
      await notifyAdminError({
        type: 'role_removal_error',
        message: 'Failed to remove student role',
        details: error,
        studentDiscordId: menteeDiscordId
      });
    }

    return {
      success: false,
      message: 'An error occurred while removing the role',
      error
    };
  }
}

/**
 * Removes the "1-on-1 Mentee" role from a Discord user
 */
async function removeDiscordRole(discordId: string, roleName: string, client?: Client): Promise<boolean> {
  try {
    // If client is provided, use it; otherwise use Discord API directly
    if (client) {
      const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
      const member = await guild.members.fetch(discordId).catch(() => null);
      
      if (!member) {
        console.log('Member not found in guild (may have left)');
        return false;
      }

      const menteeRole = guild.roles.cache.find(role => role.name === roleName);
      
      if (!menteeRole) {
        console.error(`${roleName} role not found in server`);
        return false;
      }

      await member.roles.remove(menteeRole);
      console.log(`✅ Removed ${roleName} role from ${discordId}`);
      return true;
    } else {
      // Use Discord API directly (for webhook contexts)
      const response = await fetch(
        `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        console.log('Member not found in guild (may have left)');
        return false;
      }

      // Ensure role ID is cached/fetched once
      const roleId = await getRoleIdByName(roleName);
      if (!roleId) {
        console.error(`${roleName} role not found in server`);
        return false;
      }

      // Remove the role
      await fetch(
        `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}/roles/${roleId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      console.log(`✅ Removed ${roleName} role from ${discordId}`);
      return true;
    }
  } catch (error) {
    console.error('Error removing Discord role:', error);
    return false;
  }
}

/**
 * Sends a goodbye DM to the student
 */
async function sendGoodbyeDM(discordId: string, reason: string): Promise<void> {
  try {
    const dmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: discordId,
      }),
    });

    const dmChannel: DiscordDmChannel = await dmResponse.json();

    if (dmChannel.id) {
      await fetch(`https://discord.com/api/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `👋 **Thank you for being part of ${CONFIG.ORGANIZATION_NAME}!**\n\n` +
            `Your 1-on-1 mentorship has ended: ${reason}\n\n` +
            `We hope you've had a valuable experience and wish you the best in your artistic journey! 🎨\n\n` +
            `You're always welcome to rejoin us in the future.\n\n` +
            `_Questions? ${getSupportContactString()}_`
        }),
      });
      console.log('✅ Goodbye DM sent to student');
    }
  } catch (error) {
    console.log('Could not send goodbye DM:', error);
  }
}

/**
 * Notifies admin about role removal
 */
async function notifyAdminRoleRemoval(email: string, discordId: string, reason: string): Promise<void> {
  try {
    // Send DM to admin
    const dmResponse = await fetch(`https://discord.com/api/users/@me/channels`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: process.env.DISCORD_ADMIN_ID,
      }),
    });

    const dmChannel: DiscordDmChannel = await dmResponse.json();

    if (dmChannel.id) {
      await fetch(`https://discord.com/api/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `🔴 **Student Removed**\n\n` +
            `<@${discordId}> (${email})\n` +
            `**Reason:** ${reason}\n` +
            `**Time:** ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n\n` +
            `The 1-on-1 Mentee role has been removed.`
        }),
      });
      console.log('✅ Admin notified of role removal');
    }
  } catch (error) {
    console.log('Could not notify admin:', error);
  }
}

