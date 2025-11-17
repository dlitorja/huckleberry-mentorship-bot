// src/utils/rateLimiter.ts
// Database-backed rate limiter for distributed rate limiting across multiple instances

import { supabase } from '../bot/supabaseClient.js';
import { logger } from './logger.js';

export interface RateLimitOptions {
  tokenKey: string; // The identifier (e.g., IP address, user ID)
  tokenType: string; // Type of rate limit (e.g., 'redirect', 'webhook', 'command')
  maxRequests: number; // Maximum number of requests allowed
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
  retryAfter?: number; // Seconds until retry is allowed
}

/**
 * Check and increment rate limit using database-backed storage
 * This ensures consistent rate limiting across multiple application instances
 */
export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { tokenKey, tokenType, maxRequests, windowMs } = options;
  const now = Date.now();
  const resetAt = now + windowMs;

  try {
    // Try to get existing rate limit entry
    const { data: existingEntry, error: fetchError } = await supabase
      .from('rate_limit_tokens')
      .select('count, reset_at')
      .eq('token_key', tokenKey)
      .eq('token_type', tokenType)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected for new entries)
      logger.error('Failed to fetch rate limit entry', fetchError instanceof Error ? fetchError : new Error(String(fetchError)), {
        tokenKey,
        tokenType,
      });
      // On error, allow the request to prevent blocking legitimate traffic
      return { allowed: true };
    }

    // If entry exists and is still within the window
    if (existingEntry && new Date(existingEntry.reset_at).getTime() > now) {
      const currentCount = existingEntry.count;

      if (currentCount >= maxRequests) {
        const resetAtTime = new Date(existingEntry.reset_at).getTime();
        const retryAfter = Math.ceil((resetAtTime - now) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetAt: resetAtTime,
          retryAfter,
        };
      }

      // Increment count
      const { error: updateError } = await supabase
        .from('rate_limit_tokens')
        .update({
          count: currentCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('token_key', tokenKey)
        .eq('token_type', tokenType);

      if (updateError) {
        logger.error('Failed to update rate limit entry', updateError instanceof Error ? updateError : new Error(String(updateError)), {
          tokenKey,
          tokenType,
        });
        // On error, allow the request
        return { allowed: true };
      }

      return {
        allowed: true,
        remaining: maxRequests - (currentCount + 1),
        resetAt: new Date(existingEntry.reset_at).getTime(),
      };
    }

    // Entry doesn't exist or has expired - create or reset
    const { error: upsertError } = await supabase
      .from('rate_limit_tokens')
      .upsert({
        token_key: tokenKey,
        token_type: tokenType,
        count: 1,
        reset_at: new Date(resetAt).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'token_key,token_type',
      });

    if (upsertError) {
      logger.error('Failed to upsert rate limit entry', upsertError instanceof Error ? upsertError : new Error(String(upsertError)), {
        tokenKey,
        tokenType,
      });
      // On error, allow the request
      return { allowed: true };
    }

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    };
  } catch (error) {
    logger.error('Unexpected error in rate limiter', error instanceof Error ? error : new Error(String(error)), {
      tokenKey,
      tokenType,
    });
    // On error, allow the request to prevent blocking legitimate traffic
    return { allowed: true };
  }
}

/**
 * Clean up expired rate limit entries
 * This should be run periodically to prevent the table from growing indefinitely
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('rate_limit_tokens')
      .delete()
      .lt('reset_at', now)
      .select('id');

    if (error) {
      logger.error('Failed to cleanup expired rate limits', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }

    const cleaned = data?.length || 0;
    if (cleaned > 0) {
      logger.debug('Cleaned up expired rate limit entries', { cleaned });
    }

    return cleaned;
  } catch (error) {
    logger.error('Unexpected error cleaning up rate limits', error instanceof Error ? error : new Error(String(error)));
    return 0;
  }
}

