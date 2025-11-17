// src/utils/errors.ts
// Custom error classes for consistent error handling

import { logger } from './logger.js';

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

/**
 * Discord API-related errors
 */
export class DiscordApiError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'DISCORD_API_ERROR', 502, details);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', 401, details);
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/**
 * Webhook-related errors
 */
export class WebhookError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'WEBHOOK_ERROR', 400, details);
  }
}

/**
 * Error handler utility
 */
export function handleError(error: unknown, context?: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    logger.error(`Error${context ? ` in ${context}` : ''}`, error, { context });
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      { originalError: error.name, stack: error.stack }
    );
  }

  const errorMessage = String(error);
  logger.error(`Unknown error${context ? ` in ${context}` : ''}`, new Error(errorMessage), { context });
  return new AppError(
    errorMessage,
    'UNKNOWN_ERROR',
    500,
    { originalError: typeof error }
  );
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

