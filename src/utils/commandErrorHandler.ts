// src/utils/commandErrorHandler.ts
// Standardized error handling for Discord bot commands

import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { logger } from './logger.js';
import { ValidationError } from './errors.js';

interface ErrorContext {
  commandName: string;
  userId?: string;
  guildId?: string;
  [key: string]: any;
}

/**
 * Standardized error handler for Discord bot commands
 * Handles different error types appropriately and provides user-friendly messages
 */
export async function handleCommandError(
  error: unknown,
  interaction: ChatInputCommandInteraction,
  context?: ErrorContext
): Promise<void> {
  const commandName = context?.commandName || interaction.commandName;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Log the error with context
  logger.error('Command execution error', error instanceof Error ? error : new Error(String(error)), {
    commandName,
    userId,
    guildId,
    ...context,
  });

  // Determine user-friendly error message based on error type
  let userMessage: string;
  
  if (error instanceof ValidationError) {
    userMessage = `❌ ${error.message}`;
  } else if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('database') || error.message.includes('supabase')) {
      userMessage = '❌ Database error occurred. Please try again later.';
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      userMessage = '❌ Rate limit exceeded. Please wait a moment and try again.';
    } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      userMessage = '❌ You do not have permission to perform this action.';
    } else if (error.message.includes('not found')) {
      userMessage = '❌ The requested resource was not found.';
    } else {
      userMessage = '❌ An unexpected error occurred. Please try again later.';
    }
  } else {
    userMessage = '❌ An unexpected error occurred. Please try again later.';
  }

  // Try to reply to the interaction
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(userMessage);
    } else {
      await interaction.reply({
        content: userMessage,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    // If we can't reply, log it but don't throw
    logger.error('Failed to send error message to user', replyError instanceof Error ? replyError : new Error(String(replyError)), {
      commandName,
      userId,
    });
  }
}

/**
 * Wrapper function to execute a command with standardized error handling
 */
export async function executeWithErrorHandling(
  interaction: ChatInputCommandInteraction,
  commandFn: (interaction: ChatInputCommandInteraction) => Promise<void>,
  context?: ErrorContext
): Promise<void> {
  try {
    await commandFn(interaction);
  } catch (error) {
    await handleCommandError(error, interaction, context);
  }
}

/**
 * Safely handle promise rejections in command handlers
 * Use this for fire-and-forget operations that shouldn't fail the command
 */
export function handleAsyncError<T>(
  promise: Promise<T>,
  context: { commandName: string; operation: string; [key: string]: any }
): Promise<T | null> {
  return promise.catch((error) => {
    logger.error('Async operation failed in command', error instanceof Error ? error : new Error(String(error)), context);
    return null;
  });
}

