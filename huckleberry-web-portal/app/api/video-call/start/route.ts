// app/api/video-call/start/route.ts
// Start a video call session (track in database)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseClient } from '@/lib/supabase';
import { validateMentorshipAccess } from '@/lib/agora/validate-mentorship';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get discordId from session
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

    // Create video call record
    const supabase = getSupabaseClient(true);
    const { data: videoCall, error } = await supabase
      .from('video_calls')
      .insert({
        mentorship_id: mentorshipId,
        instructor_id: accessResult.instructorId || null,
        mentee_id: accessResult.menteeId || null,
        status: 'active',
        participants: {
          instructor: accessResult.isInstructor ? { discordId, joinedAt: new Date().toISOString() } : null,
          mentee: accessResult.isMentee ? { discordId, joinedAt: new Date().toISOString() } : null,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('[Video Call Start] Database error:', error);
      // Check if table doesn't exist
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Video calls table not found. Please run the database migration: database/add_video_calls.sql' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Failed to start call tracking: ${error.message || 'Database error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      callId: videoCall.id,
      startTime: videoCall.start_time,
      mentorshipId: videoCall.mentorship_id,
    });
  } catch (error) {
    console.error('[Video Call Start] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start call' },
      { status: 500 }
    );
  }
}

