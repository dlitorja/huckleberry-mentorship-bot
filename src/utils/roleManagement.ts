// src/utils/roleManagement.ts
// Shared utility functions for Discord role management

import { Client } from 'discord.js';
import { supabase } from '../bot/supabaseClient.js';
import { CONFIG, getSupportContactString } from '../config/constants.js';
import { notifyAdminError } from './adminNotifications.js';
import { discordApi } from './discordApi.js';
import { logger } from './logger.js';

type DiscordDmChannel = { id?: string };
type DiscordRole = { id?: string; name?: string };

// Role cache with TTL to prevent memory leaks
interface RoleCacheEntry {
  roleId: string;
  expiresAt: number;
}

const cachedRoleIds: Map<string, RoleCacheEntry> = new Map();
const ROLE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Cleanup expired cache entries
function cleanupRoleCache() {
  const now = Date.now();
  let cleaned = 0;
  for (const [roleName, entry] of cachedRoleIds.entries()) {
    if (entry.expiresAt <= now) {
      cachedRoleIds.delete(roleName);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug('Cleaned up expired role cache entries', { cleaned });
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupRoleCache, 30 * 60 * 1000);

async function getRoleIdByName(roleName: string): Promise<string | null> {
  const cached = cachedRoleIds.get(roleName);
  const now = Date.now();
  
  // Return cached value if still valid
  if (cached && cached.expiresAt > now) {
    return cached.roleId;
  }
  
  try {
    const roleId = await discordApi.findRoleByName(roleName);
    if (roleId) {
      // Cache with TTL
      cachedRoleIds.set(roleName, {
        roleId,
        expiresAt: now + ROLE_CACHE_TTL_MS,
      });
      return roleId;
    }
  } catch (err) {
    logger.error('Failed to fetch Discord role by name', err instanceof Error ? err : new Error(String(err)), {
      roleName,
    });
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
  mentorshipId?: string; // Optional: target specific mentorship instead of all
  instructorId?: string; // Optional: target specific instructor's mentorship
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
  const { 
    menteeDiscordId, 
    reason = 'Mentorship ended', 
    sendGoodbyeDm = true, 
    notifyAdmin = true, 
    client, 
    roleName = '1-on-1 Mentee',
    mentorshipId,
    instructorId
  } = options;

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

    // Check if there are any remaining active mentorships BEFORE updating
    // This helps us decide if we need to remove the Discord role
    const { data: activeMentorshipsBefore } = await supabase
      .from('mentorships')
      .select('id')
      .eq('mentee_id', menteeData.id)
      .eq('status', 'active')
      .limit(1);

    // Build query to target specific mentorship(s) instead of all
    let mentorshipQuery = supabase
      .from('mentorships')
      .update({ 
        status: 'ended',
        ended_at: new Date().toISOString(),
        end_reason: reason
      })
      .eq('mentee_id', menteeData.id);

    // If mentorshipId is provided, target only that specific mentorship
    if (mentorshipId) {
      mentorshipQuery = mentorshipQuery.eq('id', mentorshipId);
    }
    // If instructorId is provided, target only that instructor's mentorship
    else if (instructorId) {
      mentorshipQuery = mentorshipQuery.eq('instructor_id', instructorId);
    }
    // Otherwise, only end ACTIVE mentorships (not already ended ones)
    // This prevents accidentally ending mentorships that are already ended
    else {
      mentorshipQuery = mentorshipQuery.eq('status', 'active');
    }

    const { error: updateError, data: updatedMentorships } = await mentorshipQuery.select('id');

    if (updateError) {
      console.error('Failed to update mentorship status:', updateError);
      return {
        success: false,
        message: 'Failed to update mentorship status',
        error: updateError
      };
    }

    // Check if there are any remaining active mentorships AFTER update
    // Only remove Discord role if ALL mentorships are ended
    const { data: activeMentorshipsAfter } = await supabase
      .from('mentorships')
      .select('id')
      .eq('mentee_id', menteeData.id)
      .eq('status', 'active')
      .limit(1);

    // Only remove Discord role if no active mentorships remain
    if (!activeMentorshipsAfter || activeMentorshipsAfter.length === 0) {
      // Try to remove Discord role first (non-critical operation)
      // If it fails, we still want to mark the mentorship as ended in DB
      const roleRemoved = await removeDiscordRole(menteeDiscordId, roleName, client);

      if (!roleRemoved) {
        // Log warning but don't fail - DB update succeeded
        console.warn(`Failed to remove Discord role for ${menteeDiscordId} - mentorship still marked as ended in database`);
        // Notify admin about the Discord role removal failure
        if (notifyAdmin) {
          await notifyAdminError({
            type: 'role_removal_error',
            message: `Failed to remove Discord role after ending mentorship`,
            details: { discordId: menteeDiscordId, email: menteeData.email },
            studentEmail: menteeData.email,
            studentDiscordId: menteeDiscordId,
          });
        }
        // Still return success since DB update worked
        return {
          success: true,
          message: `Mentorship marked as ended, but Discord role removal failed. Admin notified.`
        };
      }
    } else {
      // Still has active mentorships, don't remove role
      console.log(`Not removing Discord role - student still has ${activeMentorshipsAfter.length} active mentorship(s)`);
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

      // Remove the role using rate-limited API
      const removed = await discordApi.removeRoleFromMember(discordId, roleId);
      if (removed) {
        logger.info('Removed Discord role from member', { discordId, roleName, roleId });
        return true;
      }
      return false;
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
    const { discordApi } = await import('./discordApi.js');
    const content = `👋 **Thank you for being part of ${CONFIG.ORGANIZATION_NAME}!**\n\n` +
      `Your 1-on-1 mentorship has ended: ${reason}\n\n` +
      `We hope you've had a valuable experience and wish you the best in your artistic journey! 🎨\n\n` +
      `You're always welcome to rejoin us in the future.\n\n` +
      `_Questions? ${getSupportContactString()}_`;
    
    const sent = await discordApi.sendDM(discordId, content);
    if (sent) {
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
    const { discordApi } = await import('./discordApi.js');
    const content = `🔴 **Student Removed**\n\n` +
      `<@${discordId}> (${email})\n` +
      `**Reason:** ${reason}\n` +
      `**Time:** ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n\n` +
      `The 1-on-1 Mentee role has been removed.`;
    
    await discordApi.sendDM(CONFIG.DISCORD_ADMIN_ID, content);
    console.log('✅ Admin notified of role removal');
  } catch (error) {
    console.log('Could not notify admin:', error);
  }
}

