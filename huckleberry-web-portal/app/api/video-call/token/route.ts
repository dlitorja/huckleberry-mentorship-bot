// app/api/video-call/token/route.ts
// Generate Agora token for video calling

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateAgoraToken, isAgoraConfigured } from '@/lib/agora/token';
import { validateMentorshipAccess } from '@/lib/agora/validate-mentorship';
import { ENV_CONFIG } from '@/src/config/environment';

export async function POST(req: NextRequest) {
  try {
    // Check if Agora is configured
    if (!isAgoraConfigured()) {
      return NextResponse.json(
        { error: 'Video calling is not configured' },
        { status: 503 }
      );
    }

    // Get authenticated session
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get discordId from session (with fallback for backward compatibility)
    const discordId = String(
      (session.user as any)?.discordId ||
      (session as any)?.discordId ||
      (session.user as any)?.id ||
      ""
    );

    if (!discordId) {
      return NextResponse.json(
        { error: 'Unauthorized: No Discord ID found' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { mentorshipId } = body;

    if (!mentorshipId || typeof mentorshipId !== 'string') {
      return NextResponse.json(
        { error: 'mentorshipId is required' },
        { status: 400 }
      );
    }

    // Validate mentorship access
    const accessResult = await validateMentorshipAccess(
      discordId,
      mentorshipId
    );

    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this mentorship' },
        { status: 403 }
      );
    }

    // Determine user role for Agora
    // Instructor = host (can publish), Student = audience (can subscribe)
    const agoraRole: 'host' | 'audience' = accessResult.isInstructor
      ? 'host'
      : 'audience';

    // Generate token
    // Use mentorship ID as channel name
    // Use Discord ID as user ID (convert to number for Agora)
    const userId = discordId;
    const channelName = mentorshipId;

    const token = generateAgoraToken(
      channelName,
      userId,
      agoraRole,
      86400 // 24 hours expiration
    );

    return NextResponse.json({
      token,
      channelName,
      appId: ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID,
      userId,
      role: agoraRole,
    });
  } catch (error) {
    console.error('[Video Call Token] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}

