// src/utils/commandRateLimit.ts
// Rate limiting for Discord bot commands to prevent spam and abuse

import { ChatInputCommandInteraction } from 'discord.js';
import { logger } from './logger.js';

interface CommandRateEntry {
  count: number;
  resetAt: number;
  lastCommand: string;
}

// Rate limit tracking per user
const commandRateMap: Map<string, CommandRateEntry> = new Map();

// Configuration
const COMMAND_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const COMMAND_RATE_LIMIT_MAX = parseInt(process.env.COMMAND_RATE_LIMIT_MAX || '10', 10); // commands per minute per user
const COMMAND_COOLDOWN_MS = parseInt(process.env.COMMAND_COOLDOWN_MS || '2000', 10); // 2 seconds between same command

/**
 * Cleanup expired rate limit entries to prevent memory leak
 */
function cleanupCommandRateMap() {
  const now = Date.now();
  let cleaned = 0;
  for (const [userId, entry] of commandRateMap.entries()) {
    if (entry.resetAt <= now) {
      commandRateMap.delete(userId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug('Cleaned up expired command rate limit entries', { cleaned });
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupCommandRateMap, 5 * 60 * 1000);

/**
 * Check if a user can execute a command (rate limiting)
 * Returns { allowed: boolean, retryAfter?: number }
 */
export function checkCommandRateLimit(
  userId: string,
  commandName: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = commandRateMap.get(userId);

  // Check cooldown for same command
  if (entry && entry.lastCommand === commandName) {
    const timeSinceLastCommand = now - (entry.resetAt - COMMAND_RATE_LIMIT_WINDOW_MS);
    if (timeSinceLastCommand < COMMAND_COOLDOWN_MS) {
      const retryAfter = COMMAND_COOLDOWN_MS - timeSinceLastCommand;
      return {
        allowed: false,
        retryAfter: Math.ceil(retryAfter / 1000), // Convert to seconds
      };
    }
  }

  // Check general rate limit
  if (!entry || entry.resetAt <= now) {
    // Create new entry or reset expired entry
    commandRateMap.set(userId, {
      count: 1,
      resetAt: now + COMMAND_RATE_LIMIT_WINDOW_MS,
      lastCommand: commandName,
    });
    return { allowed: true };
  }

  // Entry exists and is still valid
  if (entry.count >= COMMAND_RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    logger.warn('Command rate limit exceeded', {
      userId,
      commandName,
      count: entry.count,
      limit: COMMAND_RATE_LIMIT_MAX,
      retryAfter,
    });
    return {
      allowed: false,
      retryAfter,
    };
  }

  // Increment count and update last command
  entry.count += 1;
  entry.lastCommand = commandName;
  return { allowed: true };
}

/**
 * Middleware to apply rate limiting to command execution
 * Should be called before executing the command
 */
export async function applyCommandRateLimit(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const userId = interaction.user.id;
  const commandName = interaction.commandName;

  const { allowed, retryAfter } = checkCommandRateLimit(userId, commandName);

  if (!allowed) {
    const message = retryAfter
      ? `⏱️ **Rate Limited**\n\nYou're using commands too quickly. Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before trying again.`
      : `⏱️ **Rate Limited**\n\nYou're using commands too quickly. Please slow down.`;

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message);
      } else {
        await interaction.reply({
          content: message,
          ephemeral: true,
        });
      }
    } catch (error) {
      // Ignore errors (interaction may have expired)
      logger.warn('Failed to send rate limit message', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        commandName,
      });
    }

    return false;
  }

  return true;
}

