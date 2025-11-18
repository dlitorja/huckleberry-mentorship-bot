// app/api/video-call/history/route.ts
// Get video call history for a mentorship

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseClient } from '@/lib/supabase';
import { validateMentorshipAccess } from '@/lib/agora/validate-mentorship';

export async function GET(req: NextRequest) {
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

    // Get mentorshipId from query params
    const { searchParams } = new URL(req.url);
    const mentorshipId = searchParams.get('mentorshipId');

    if (!mentorshipId) {
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

    // Get call history
    const supabase = getSupabaseClient(true);
    const { data: calls, error } = await supabase
      .from('video_calls')
      .select('id, start_time, end_time, duration_seconds, status, participants')
      .eq('mentorship_id', mentorshipId)
      .order('start_time', { ascending: false })
      .limit(50); // Limit to last 50 calls

    if (error) {
      console.error('[Video Call History] Database error:', error);
      // Check if table doesn't exist
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Video calls table not found. Please run the database migration: database/add_video_calls.sql' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch call history: ${error.message || 'Database error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      calls: calls || [],
    });
  } catch (error) {
    console.error('[Video Call History] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call history' },
      { status: 500 }
    );
  }
}

