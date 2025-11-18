// app/api/video-call/end/route.ts
// End a video call session (update database record)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseClient } from '@/lib/supabase';

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
    const { callId, recordingStarted } = body;

    if (!callId || typeof callId !== 'string') {
      return NextResponse.json(
        { error: 'callId is required' },
        { status: 400 }
      );
    }

    // Get the video call record
    const supabase = getSupabaseClient(true);
    const { data: videoCall, error: fetchError } = await supabase
      .from('video_calls')
      .select('id, start_time, mentorship_id')
      .eq('id', callId)
      .maybeSingle();

    if (fetchError || !videoCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this mentorship (check if they're instructor or mentee)
    const { data: mentorship } = await supabase
      .from('mentorships')
      .select('instructor_id, mentee_id')
      .eq('id', videoCall.mentorship_id)
      .maybeSingle();

    if (!mentorship) {
      return NextResponse.json(
        { error: 'Mentorship not found' },
        { status: 404 }
      );
    }

    // Check if user is instructor or mentee
    const { data: instructor } = await supabase
      .from('instructors')
      .select('id')
      .eq('id', mentorship.instructor_id)
      .eq('discord_id', discordId)
      .maybeSingle();

    const { data: mentee } = await supabase
      .from('mentees')
      .select('id')
      .eq('id', mentorship.mentee_id)
      .eq('discord_id', discordId)
      .maybeSingle();

    if (!instructor && !mentee) {
      return NextResponse.json(
        { error: 'You do not have access to this call' },
        { status: 403 }
      );
    }

    // Calculate duration
    const startTime = new Date(videoCall.start_time);
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    // Prepare the update data
    const updateData: any = {
      end_time: endTime.toISOString(),
      duration_seconds: durationSeconds,
      status: 'ended',
    };

    // If recording was started but not finished, update recording status to 'failed'
    if (recordingStarted) {
      updateData.recording_status = 'failed';
    }

    // Update video call record
    const { error: updateError } = await supabase
      .from('video_calls')
      .update(updateData)
      .eq('id', callId);

    if (updateError) {
      console.error('[Video Call End] Database error:', updateError);
      return NextResponse.json(
        { error: 'Failed to end call' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      callId,
      durationSeconds,
      endTime: endTime.toISOString(),
    });
  } catch (error) {
    console.error('[Video Call End] Error:', error);
    return NextResponse.json(
      { error: 'Failed to end call' },
      { status: 500 }
    );
  }
}

