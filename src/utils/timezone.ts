// src/utils/timezone.ts
// Timezone handling utilities for consistent date/time operations

/**
 * Get current date in UTC, normalized to start of day
 */
export function getUTCDate(date?: Date): Date {
  const d = date || new Date();
  const utc = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  ));
  return utc;
}

/**
 * Format date for display (consistent format across the app)
 */
export function formatDate(date: Date | string, options?: {
  includeTime?: boolean;
  timezone?: string;
}): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  
  if (options?.includeTime) {
    formatOptions.hour = 'numeric';
    formatOptions.minute = '2-digit';
    formatOptions.hour12 = true;
  }
  
  if (options?.timezone) {
    return d.toLocaleString('en-US', { ...formatOptions, timeZone: options.timezone });
  }
  
  return d.toLocaleDateString('en-US', formatOptions);
}

/**
 * Format date and time for display
 */
export function formatDateTime(date: Date | string, timezone?: string): string {
  return formatDate(date, { includeTime: true, timezone });
}

/**
 * Parse date string with consistent handling
 * Supports: YYYY-MM-DD, MM/DD/YYYY, and ISO strings
 */
export function parseDate(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  
  // Try ISO format first
  if (dateString.includes('T') || dateString.includes('Z')) {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const date = new Date(dateString + 'T00:00:00Z');
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Try MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    const parts = dateString.split('/');
    const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(year, month, day));
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Fallback to Date constructor
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today
  return d > now;
}

/**
 * Get date N days ago
 */
export function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Get start of day in UTC
 */
export function getStartOfDay(date?: Date): Date {
  const d = date || new Date();
  return new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * Get end of day in UTC
 */
export function getEndOfDay(date?: Date): Date {
  const d = date || new Date();
  return new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    23, 59, 59, 999
  ));
}

