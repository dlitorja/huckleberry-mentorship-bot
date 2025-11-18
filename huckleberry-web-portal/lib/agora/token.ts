// lib/agora/token.ts
// Agora token generation utility

import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { ENV_CONFIG } from '@/src/config/environment';

export type AgoraUserRole = 'host' | 'audience';

/**
 * Generate an Agora RTC token for video calling
 * @param channelName - The channel name (typically mentorship ID)
 * @param userId - The user ID (Discord ID as string)
 * @param role - User role: 'host' (instructor) or 'audience' (student)
 * @param expirationTimeInSeconds - Token expiration time (default: 24 hours)
 * @returns The generated token string
 */
export function generateAgoraToken(
  channelName: string,
  userId: string,
  role: AgoraUserRole = 'audience',
  expirationTimeInSeconds: number = 86400 // 24 hours
): string {
  const appId = ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate = ENV_CONFIG.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error('Agora App ID and Certificate are required');
  }

  // Convert role to Agora RtcRole
  const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  // Current timestamp in seconds
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const tokenExpiredTs = currentTimestamp + expirationTimeInSeconds;
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  // Generate token using buildTokenWithUserAccount (uses string userId)
  // Parameters: appId, appCertificate, channelName, userId, role, tokenExpire, privilegeExpire
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    appCertificate,
    channelName,
    userId, // Use Discord ID as account string
    agoraRole,
    tokenExpiredTs,
    privilegeExpiredTs
  );

  return token;
}

/**
 * Validate that Agora credentials are configured
 */
export function isAgoraConfigured(): boolean {
  return !!(
    ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID &&
    ENV_CONFIG.AGORA_APP_CERTIFICATE
  );
}

