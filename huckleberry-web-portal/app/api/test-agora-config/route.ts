// app/api/test-agora-config/route.ts
// Temporary test route to verify Agora configuration
// Remove this file after verification is complete

import { NextResponse } from 'next/server';
import { ENV_CONFIG } from '@/src/config/environment';
import { isAgoraConfigured } from '@/lib/agora/token';

export async function GET() {
  const hasAppId = !!ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID;
  const hasCertificate = !!ENV_CONFIG.AGORA_APP_CERTIFICATE;
  const appIdLength = ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID?.length || 0;
  const certLength = ENV_CONFIG.AGORA_APP_CERTIFICATE?.length || 0;
  const isConfigured = isAgoraConfigured();

  // Show first 8 characters for verification (don't expose full credentials)
  const appIdPreview = hasAppId 
    ? `${ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID.substring(0, 8)}...` 
    : 'missing';
  const certPreview = hasCertificate 
    ? `${ENV_CONFIG.AGORA_APP_CERTIFICATE.substring(0, 8)}...` 
    : 'missing';

  return NextResponse.json({
    configured: isConfigured,
    status: isConfigured ? '✅ Configured' : '❌ Not Configured',
    appId: {
      exists: hasAppId,
      length: appIdLength,
      preview: appIdPreview,
      valid: appIdLength >= 10, // Agora App IDs are typically 32 characters
    },
    certificate: {
      exists: hasCertificate,
      length: certLength,
      preview: certPreview,
      valid: certLength >= 20, // Agora certificates are typically 32+ characters
    },
    message: isConfigured 
      ? 'Agora is properly configured. You can proceed with testing.'
      : 'Agora configuration is incomplete. Check your .env.local file and restart the dev server.',
  });
}

