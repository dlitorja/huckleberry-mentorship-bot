"use client";
// app/(dashboard)/video-call/[mentorshipId]/page.tsx
// Video call page that fetches token and initializes video call

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoCall } from '@/components/VideoCall';

export default function VideoCallPage() {
  const params = useParams();
  const router = useRouter();
  const mentorshipId = params.mentorshipId as string;

  const [tokenData, setTokenData] = useState<{
    token: string;
    appId: string;
    userId: string;
    channelName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  // Fetch token and start call tracking
  useEffect(() => {
    async function initializeCall() {
      try {
        setLoading(true);
        setError(null);

        // Get token
        const tokenResponse = await fetch('/api/video-call/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mentorshipId }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.error || 'Failed to get token');
        }

        const tokenData = await tokenResponse.json();
        setTokenData(tokenData);

        // Start call tracking
        const startResponse = await fetch('/api/video-call/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mentorshipId }),
        });

        if (startResponse.ok) {
          const startData = await startResponse.json();
          setCallId(startData.callId);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize call');
      } finally {
        setLoading(false);
      }
    }

    if (mentorshipId) {
      initializeCall();
    }
  }, [mentorshipId]);

  const handleLeave = async () => {
    // End call tracking
    if (callId) {
      try {
        await fetch('/api/video-call/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId }),
        });
      } catch (err) {
        console.error('Failed to end call tracking:', err);
      }
    }

    // Navigate back
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-neutral-400">Initializing video call...</p>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error</p>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
            {error || 'Failed to initialize call'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <VideoCall
        appId={tokenData.appId}
        channelName={tokenData.channelName}
        token={tokenData.token}
        userId={tokenData.userId}
        onLeave={handleLeave}
        onError={(err) => setError(err.message)}
      />
    </div>
  );
}

