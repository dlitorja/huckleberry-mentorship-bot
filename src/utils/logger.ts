// src/utils/logger.ts
// Structured logging utility for consistent log formatting and observability

import { getRequestId } from './requestId.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

/**
 * Format log entry as JSON for structured logging
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'development') {
    // Pretty print in development
    const colorMap: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const color = colorMap[entry.level] || '';
    
    let output = `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}${reset} ${entry.message}`;
    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context, null, 2)}`;
    }
    if (entry.error) {
      output += `\n${color}Error: ${entry.error.message}${reset}`;
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }
    return output;
  }
  
  // JSON format in production
  return JSON.stringify(entry);
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  
  // Automatically include request ID if available in context
  const requestId = getRequestId();
  const enrichedContext: LogContext = { ...context };
  
  if (requestId) {
    enrichedContext.requestId = requestId;
  }
  
  if (enrichedContext && Object.keys(enrichedContext).length > 0) {
    entry.context = enrichedContext;
  }
  
  if (error) {
    entry.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  
  return entry;
}

/**
 * Structured logger
 */
export const logger = {
  /**
   * Debug level logging (verbose information)
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      const entry = createLogEntry('debug', message, context);
      console.log(formatLogEntry(entry));
    }
  },

  /**
   * Info level logging (general information)
   */
  info(message: string, context?: LogContext): void {
    const entry = createLogEntry('info', message, context);
    console.log(formatLogEntry(entry));
  },

  /**
   * Warn level logging (warnings)
   */
  warn(message: string, context?: LogContext): void {
    const entry = createLogEntry('warn', message, context);
    console.warn(formatLogEntry(entry));
  },

  /**
   * Error level logging (errors)
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const entry = createLogEntry('error', message, context, error);
    console.error(formatLogEntry(entry));
  },

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry = createLogEntry(level, message, context, error);
    const output = formatLogEntry(entry);
    
    switch (level) {
      case 'debug':
        if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
          console.log(output);
        }
        break;
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  },
};

