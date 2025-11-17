// src/utils/discordApi.ts
// Centralized Discord API utility for consistent API interactions
// Replaces direct fetch calls with standardized error handling and rate limiting

import { CONFIG } from '../config/constants.js';
import { logger } from './logger.js';

const DISCORD_API_BASE = 'https://discord.com/api';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!BOT_TOKEN) {
  throw new Error('DISCORD_BOT_TOKEN environment variable is required');
}

if (!GUILD_ID) {
  throw new Error('DISCORD_GUILD_ID environment variable is required');
}

/**
 * Rate limit tracking per endpoint bucket
 * Discord uses bucket-based rate limiting, but we'll track globally for simplicity
 */
interface RateLimitInfo {
  remaining: number;
  resetAt: number; // Timestamp in milliseconds
  limit: number;
}

const rateLimitMap = new Map<string, RateLimitInfo>();

/**
 * Cleanup expired rate limit entries to prevent memory leak
 */
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [bucket, info] of rateLimitMap.entries()) {
    if (info.resetAt <= now) {
      rateLimitMap.delete(bucket);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitMap, 5 * 60 * 1000);

/**
 * Extract rate limit bucket from endpoint
 * For simplicity, we use the endpoint path as the bucket key
 */
function getBucketKey(endpoint: string): string {
  // Remove query params and use path as bucket
  const path = endpoint.split('?')[0];
  // Group similar endpoints (e.g., all /guilds/{id}/members/{id}/roles/{id} requests)
  return path.replace(/\/\d+/g, '/{id}');
}

/**
 * Check if we should wait before making a request
 */
function shouldWaitForRateLimit(bucketKey: string): number {
  const info = rateLimitMap.get(bucketKey);
  if (!info) return 0;
  
  const now = Date.now();
  if (info.resetAt > now && info.remaining <= 0) {
    return info.resetAt - now;
  }
  return 0;
}

/**
 * Update rate limit info from response headers
 */
function updateRateLimitInfo(bucketKey: string, headers: Headers) {
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  const limit = headers.get('x-ratelimit-limit');
  
  if (remaining !== null && reset !== null) {
    // Discord sends reset as a Unix timestamp in seconds
    const resetAt = parseInt(reset, 10) * 1000;
    rateLimitMap.set(bucketKey, {
      remaining: parseInt(remaining, 10),
      resetAt,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }
}

/**
 * Standard headers for Discord API requests
 */
function getHeaders(): Record<string, string> {
  return {
    'Authorization': `Bot ${BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Make a Discord API request with rate limiting and standardized error handling
 */
async function discordRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${DISCORD_API_BASE}${endpoint}`;
  const bucketKey = getBucketKey(endpoint);
  
  // Check rate limits before making request
  const waitTime = shouldWaitForRateLimit(bucketKey);
  if (waitTime > 0) {
    const waitSeconds = Math.ceil(waitTime / 1000);
    logger.warn('Discord API rate limit reached, waiting', {
      bucket: bucketKey,
      waitSeconds,
      endpoint,
    });
    await new Promise(resolve => setTimeout(resolve, waitTime + 100)); // Add 100ms buffer
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  // Update rate limit info from response headers
  updateRateLimitInfo(bucketKey, response.headers);

  // Handle rate limit (429) responses
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const retryAfterMs = retryAfter ? parseFloat(retryAfter) * 1000 : 1000;
    
    // Update rate limit info with retry-after
    const now = Date.now();
    rateLimitMap.set(bucketKey, {
      remaining: 0,
      resetAt: now + retryAfterMs,
      limit: 50,
    });
    
    if (retryCount < 3) {
      logger.warn('Discord API rate limited (429), retrying', {
        bucket: bucketKey,
        endpoint,
        retryAfterMs,
        attempt: retryCount + 1,
        maxRetries: 3,
      });
      await new Promise(resolve => setTimeout(resolve, retryAfterMs + 100));
      return discordRequest<T>(endpoint, options, retryCount + 1);
    } else {
      const error = new Error(`Discord API rate limit exceeded after ${retryCount + 1} retries`);
      logger.error('Discord API rate limit exceeded', error, {
        bucket: bucketKey,
        endpoint,
        retryCount: retryCount + 1,
      });
      throw error;
    }
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Discord API error (${response.status}): ${errorText}`
    );
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  
  return {} as T;
}

/**
 * Discord API utility functions
 */
export const discordApi = {
  /**
   * Get a user's DM channel or create one
   */
  async getOrCreateDMChannel(userId: string): Promise<string | null> {
    try {
      const channel = await discordRequest<{ id?: string }>(
        '/users/@me/channels',
        {
          method: 'POST',
          body: JSON.stringify({ recipient_id: userId }),
        }
      );
      return channel.id || null;
    } catch (error) {
      logger.error('Failed to get/create DM channel', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return null;
    }
  },

  /**
   * Send a DM to a user
   */
  async sendDM(userId: string, content: string): Promise<boolean> {
    try {
      const channelId = await this.getOrCreateDMChannel(userId);
      if (!channelId) {
        return false;
      }

      await discordRequest(
        `/channels/${channelId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        }
      );
      return true;
    } catch (error) {
      logger.error('Failed to send DM', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return false;
    }
  },

  /**
   * Get all guild roles
   */
  async getGuildRoles(): Promise<Array<{ id: string; name: string }>> {
    try {
      const roles = await discordRequest<Array<{ id?: string; name?: string }>>(
        `/guilds/${GUILD_ID}/roles`
      );
      return roles
        .filter((r): r is { id: string; name: string } => Boolean(r.id && r.name))
        .map(r => ({ id: r.id!, name: r.name! }));
    } catch (error) {
      logger.error('Failed to fetch guild roles', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  },

  /**
   * Find a role by name
   */
  async findRoleByName(roleName: string): Promise<string | null> {
    const roles = await this.getGuildRoles();
    const role = roles.find(r => r.name === roleName);
    return role?.id || null;
  },

  /**
   * Add a role to a guild member
   */
  async addRoleToMember(userId: string, roleId: string): Promise<boolean> {
    try {
      await discordRequest(
        `/guilds/${GUILD_ID}/members/${userId}/roles/${roleId}`,
        { method: 'PUT' }
      );
      return true;
    } catch (error) {
      logger.error('Failed to add role to member', error instanceof Error ? error : new Error(String(error)), {
        userId,
        roleId,
      });
      return false;
    }
  },

  /**
   * Remove a role from a guild member
   */
  async removeRoleFromMember(userId: string, roleId: string): Promise<boolean> {
    try {
      await discordRequest(
        `/guilds/${GUILD_ID}/members/${userId}/roles/${roleId}`,
        { method: 'DELETE' }
      );
      return true;
    } catch (error) {
      logger.error('Failed to remove role from member', error instanceof Error ? error : new Error(String(error)), {
        userId,
        roleId,
      });
      return false;
    }
  },

  /**
   * Get guild member information
   */
  async getGuildMember(userId: string): Promise<any | null> {
    try {
      return await discordRequest(`/guilds/${GUILD_ID}/members/${userId}`);
    } catch (error) {
      logger.error('Failed to get guild member', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return null;
    }
  },

  /**
   * Add a member to the guild (OAuth flow)
   */
  async addGuildMember(userId: string, accessToken: string): Promise<boolean> {
    try {
      await discordRequest(
        `/guilds/${GUILD_ID}/members/${userId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ access_token: accessToken }),
        }
      );
      return true;
    } catch (error) {
      logger.error('Failed to add member to guild', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return false;
    }
  },

  /**
   * OAuth: Exchange code for token
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<{ access_token: string; token_type: string; expires_in: number; refresh_token: string; scope: string } | null> {
    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Discord OAuth credentials not configured');
      }

      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth token exchange failed: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to exchange OAuth code for token', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  },

  /**
   * OAuth: Get current user info
   */
  async getCurrentUser(accessToken: string): Promise<any | null> {
    try {
      return await discordRequest('/users/@me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      logger.error('Failed to get current user', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  },
};

