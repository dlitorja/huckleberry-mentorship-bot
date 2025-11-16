import { supabase } from '../bot/supabaseClient.js';
import crypto from 'crypto';

export interface ClickData {
  shortCode: string;
  userAgent: string | null;
  referer: string | null;
  ip: string | null;
}

export async function logClick(data: ClickData): Promise<void> {
  const { userAgent, referer, ip } = data;

  const deviceInfo = parseUserAgent(userAgent || '');
  const ipHash = ip ? hashIP(ip) : null;

  await supabase
    .from('url_analytics')
    .insert({
      short_code: data.shortCode,
      user_agent: userAgent,
      referer: referer,
      ip_hash: ipHash,
      device_type: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os
    });
}

function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function parseUserAgent(userAgent: string): {
  deviceType: string;
  browser: string;
  os: string;
} {
  const ua = userAgent.toLowerCase();

  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }

  let browser = 'unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';

  let os = 'unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return { deviceType, browser, os };
}


