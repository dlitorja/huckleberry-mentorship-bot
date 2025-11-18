// app/api/video-call/recordings/route.ts
// API for managing video call recordings

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseClient } from '@/lib/supabase';
import { validateMentorshipAccess } from '@/lib/agora/validate-mentorship';
import { getVideoSignedUrl } from '@/lib/storage/backblaze-b2';

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

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const mentorshipId = searchParams.get('mentorshipId');
    const callId = searchParams.get('callId');
    const includeSignedUrl = searchParams.get('includeSignedUrl') === 'true';

    // Validate either mentorshipId or callId is provided
    if (!mentorshipId && !callId) {
      return NextResponse.json(
        { error: 'Either mentorshipId or callId is required' },
        { status: 400 }
      );
    }

    // If mentorshipId is provided, validate access
    if (mentorshipId) {
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
    }

    // Query for recordings
    const supabase = getSupabaseClient(true);
    
    let query = supabase
      .from('video_calls')
      .select('id, mentorship_id, start_time, end_time, duration_seconds, recording_status, recording_url, recording_key, recording_size, recording_duration_seconds, recording_metadata')
      .not('recording_status', 'is', null); // Only return calls that have been recorded or attempted to record

    if (callId) {
      query = query.eq('id', callId);
    } else if (mentorshipId) {
      query = query.eq('mentorship_id', mentorshipId);
    }

    query = query.order('start_time', { ascending: false });

    const { data: recordings, error } = await query;

    if (error) {
      console.error('[Video Recordings] Database error:', error);
      return NextResponse.json(
        { error: `Failed to fetch recordings: ${error.message || 'Database error'}` },
        { status: 500 }
      );
    }

    // If requested, get signed URLs for private access
    if (includeSignedUrl && recordings) {
      for (const recording of recordings) {
        if (recording.recording_key) {
          try {
            recording.recording_signed_url = await getVideoSignedUrl(recording.recording_key);
          } catch (err) {
            console.error(`Failed to get signed URL for recording ${recording.id}:`, err);
            recording.recording_signed_url = null;
          }
        }
      }
    }

    return NextResponse.json({
      recordings: recordings || [],
    });
  } catch (error) {
    console.error('[Video Recordings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}

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
    const { callId, recordingStatus, recordingUrl, recordingKey, recordingSize, recordingDuration, recordingMetadata, channelName, uid } = body;

    if (!callId) {
      return NextResponse.json(
        { error: 'callId is required' },
        { status: 400 }
      );
    }

    // Validate that the user has access to this call (by getting the call and checking mentorship access)
    const supabase = getSupabaseClient(true);
    const { data: videoCall, error: fetchError } = await supabase
      .from('video_calls')
      .select('mentorship_id')
      .eq('id', callId)
      .maybeSingle();

    if (fetchError || !videoCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Validate mentorship access
    const accessResult = await validateMentorshipAccess(
      discordId,
      videoCall.mentorship_id
    );

    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this call' },
        { status: 403 }
      );
    }

    // If we're starting a recording, trigger the actual cloud recording
    if (recordingStatus === 'recording' && channelName && uid) {
      try {
        // Import the recording service dynamically to avoid server-side issues
        const { RecordingService } = await import('@/lib/agora/recording-service');
        const recordingService = RecordingService.getInstance();

        const result = await recordingService.startRecording(
          callId,
          channelName,
          uid
        );

        if (!result.success) {
          console.error('Failed to start cloud recording:', result.error);
          // We'll still update the status to 'recording' but add the error to metadata
          const { error: updateError } = await supabase
            .from('video_calls')
            .update({
              recording_status: 'recording',
              recording_metadata: {
                ...recordingMetadata,
                error: result.error,
                cloudRecordingStartAttempted: true,
              }
            })
            .eq('id', callId);

          if (updateError) {
            console.error('[Video Recordings] Database update error:', updateError);
            return NextResponse.json(
              { error: `Failed to update recording: ${updateError.message || 'Database error'}` },
              { status: 500 }
            );
          }
        }
      } catch (err) {
        console.error('Error importing recording service:', err);
        // Update the status anyway
        const { error: updateError } = await supabase
          .from('video_calls')
          .update({
            recording_status: 'recording',
            recording_metadata: {
              ...recordingMetadata,
              cloudRecordingStartError: (err as Error).message,
            }
          })
          .eq('id', callId);
      }
    } else if (recordingStatus === 'recorded') {
      // If we're stopping a recording, actually stop the Agora cloud recording
      try {
        // Get the current call record to find the resourceId
        const { data: currentCall, error: fetchCallError } = await supabase
          .from('video_calls')
          .select('recording_metadata, recording_status')
          .eq('id', callId)
          .maybeSingle();

        if (fetchCallError || !currentCall) {
          console.error('[Video Recordings] Failed to fetch call for stopping recording:', fetchCallError);
          return NextResponse.json(
            { error: 'Call not found' },
            { status: 404 }
          );
        }

        // Check if recording was actually started (has resourceId in metadata)
        const metadata = currentCall.recording_metadata as any;
        const resourceId = metadata?.agoraResourceId;
        const recordingUid = metadata?.uid || uid; // Fallback to uid from request if not in metadata

        if (resourceId && currentCall.recording_status === 'recording') {
          // Import the recording service to stop the recording
          const { RecordingService } = await import('@/lib/agora/recording-service');
          const recordingService = RecordingService.getInstance();

          const stopResult = await recordingService.stopRecording(
            resourceId,
            recordingUid || uid || '0' // Use uid from metadata, request, or default
          );

          if (!stopResult.success) {
            console.error('[Video Recordings] Failed to stop cloud recording:', stopResult.error);
            // Update status to failed if we couldn't stop it
            const { error: updateError } = await supabase
              .from('video_calls')
              .update({
                recording_status: 'failed',
                recording_metadata: {
                  ...metadata,
                  stopError: stopResult.error,
                }
              })
              .eq('id', callId);

            if (updateError) {
              console.error('[Video Recordings] Database update error:', updateError);
            }

            return NextResponse.json(
              { error: `Failed to stop recording: ${stopResult.error}` },
              { status: 500 }
            );
          }

          // Recording stopped successfully, update with any additional data provided
          const updateData: any = {
            recording_status: 'recorded',
          };
          if (recordingUrl) updateData.recording_url = recordingUrl;
          if (recordingKey) updateData.recording_key = recordingKey;
          if (recordingSize) updateData.recording_size = recordingSize;
          if (recordingDuration) updateData.recording_duration_seconds = recordingDuration;
          if (recordingMetadata) {
            updateData.recording_metadata = {
              ...metadata,
              ...recordingMetadata,
              stoppedAt: new Date().toISOString(),
            };
          }

          const { error: updateError } = await supabase
            .from('video_calls')
            .update(updateData)
            .eq('id', callId);

          if (updateError) {
            console.error('[Video Recordings] Database update error after stopping:', updateError);
            return NextResponse.json(
              { error: `Failed to update recording: ${updateError.message || 'Database error'}` },
              { status: 500 }
            );
          }
        } else {
          // No active recording to stop, just update the status
          const updateData: any = {
            recording_status: 'recorded',
          };
          if (recordingUrl) updateData.recording_url = recordingUrl;
          if (recordingKey) updateData.recording_key = recordingKey;
          if (recordingSize) updateData.recording_size = recordingSize;
          if (recordingDuration) updateData.recording_duration_seconds = recordingDuration;
          if (recordingMetadata) updateData.recording_metadata = recordingMetadata;

          const { error: updateError } = await supabase
            .from('video_calls')
            .update(updateData)
            .eq('id', callId);

          if (updateError) {
            console.error('[Video Recordings] Database update error:', updateError);
            return NextResponse.json(
              { error: `Failed to update recording: ${updateError.message || 'Database error'}` },
              { status: 500 }
            );
          }
        }
      } catch (err) {
        console.error('[Video Recordings] Error stopping recording:', err);
        // Try to update status anyway
        const { error: updateError } = await supabase
          .from('video_calls')
          .update({
            recording_status: 'failed',
            recording_metadata: {
              stopError: (err as Error).message,
            }
          })
          .eq('id', callId);

        return NextResponse.json(
          { error: `Failed to stop recording: ${(err as Error).message}` },
          { status: 500 }
        );
      }
    } else {
      // Update the recording information for other status changes
      const updateData: any = {};
      if (recordingStatus) updateData.recording_status = recordingStatus;
      if (recordingUrl) updateData.recording_url = recordingUrl;
      if (recordingKey) updateData.recording_key = recordingKey;
      if (recordingSize) updateData.recording_size = recordingSize;
      if (recordingDuration) updateData.recording_duration_seconds = recordingDuration;
      if (recordingMetadata) updateData.recording_metadata = recordingMetadata;

      const { error: updateError } = await supabase
        .from('video_calls')
        .update(updateData)
        .eq('id', callId);

      if (updateError) {
        console.error('[Video Recordings] Database update error:', updateError);
        return NextResponse.json(
          { error: `Failed to update recording: ${updateError.message || 'Database error'}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      callId,
    });
  } catch (error) {
    console.error('[Video Recordings] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to update recording' },
      { status: 500 }
    );
  }
}