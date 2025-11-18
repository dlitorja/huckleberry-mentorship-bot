"use client";
// components/VideoCall.tsx
// Main video call component with Agora SDK integration

import { useEffect, useRef } from 'react';
import { useAgoraVideoCall } from '@/hooks/useAgoraVideoCall';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

interface VideoCallProps {
  appId: string;
  channelName: string;
  token: string;
  userId: string;
  onLeave?: () => void;
  onError?: (error: Error) => void;
}

export function VideoCall({
  appId,
  channelName,
  token,
  userId,
  onLeave,
  onError,
}: VideoCallProps) {
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRefs = useRef<Map<number | string, HTMLDivElement>>(new Map());

  const {
    callState,
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    isMuted,
    isVideoEnabled,
    error,
    isClientReady,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleVideo,
  } = useAgoraVideoCall({
    appId,
    channelName,
    token,
    userId,
    onError,
  });

  // Auto-join when client is ready and we have all required data
  useEffect(() => {
    // Only join if client is ready, we have all required data, and are in idle state
    if (isClientReady && appId && channelName && token && userId && callState === 'idle') {
      joinChannel();
    }
    
    // Cleanup: only leave if we're actually in a call (joined or joining)
    return () => {
      if (callState === 'joined' || callState === 'joining') {
        leaveChannel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientReady, appId, channelName, token, userId]); // Removed callState, joinChannel, leaveChannel from deps to prevent loops

  // Render local video
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play(localVideoRef.current);
      return () => {
        localVideoTrack.stop();
      };
    }
  }, [localVideoTrack]);

  // Render remote videos
  useEffect(() => {
    remoteUsers.forEach((user) => {
      if (user.videoTrack) {
        const container = remoteVideoRefs.current.get(user.uid);
        if (container) {
          user.videoTrack.play(container);
        }
      }
    });

    return () => {
      remoteUsers.forEach((user) => {
        user.videoTrack?.stop();
      });
    };
  }, [remoteUsers]);

  const handleLeave = async () => {
    await leaveChannel();
    onLeave?.();
  };

  if (error) {
    const isConfigError = error.message.includes('not configured') || error.message.includes('Agora App ID');
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error</p>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">{error.message}</p>
          {isConfigError && (
            <div className="mt-4 p-4 bg-gray-800 dark:bg-gray-700 rounded-lg text-left text-sm">
              <p className="text-yellow-400 dark:text-yellow-500 font-semibold mb-2">Setup Required:</p>
              <p className="text-gray-300 dark:text-gray-400 mb-2">
                Add these to your <code className="bg-gray-700 dark:bg-gray-600 px-1 rounded">.env.local</code> file:
              </p>
              <pre className="bg-gray-700 dark:bg-gray-600 p-2 rounded text-xs overflow-x-auto text-gray-200">
{`NEXT_PUBLIC_AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate`}
              </pre>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                Get credentials from{' '}
                <a 
                  href="https://www.agora.io/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-400 dark:text-blue-500 hover:underline"
                >
                  agora.io
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (callState === 'joining') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-neutral-400">Joining call...</p>
        </div>
      </div>
    );
  }

  if (callState === 'leaving') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600 dark:text-neutral-400">Leaving call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-900">
        {/* Local Video */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <div
            ref={localVideoRef}
            className="w-full h-full min-h-[200px]"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Camera Off</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            You {isMuted && '(Muted)'}
          </div>
        </div>

        {/* Remote Videos */}
        {remoteUsers.length === 0 ? (
          <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400">Waiting for others to join...</p>
            </div>
          </div>
        ) : (
          remoteUsers.map((user) => (
            <div
              key={user.uid}
              className="relative bg-black rounded-lg overflow-hidden"
            >
              <div
                ref={(el) => {
                  if (el) {
                    remoteVideoRefs.current.set(user.uid, el);
                  } else {
                    remoteVideoRefs.current.delete(user.uid);
                  }
                }}
                className="w-full h-full min-h-[200px]"
              />
              {!user.videoTrack && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="text-center">
                    <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Camera Off</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                User {user.uid}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 p-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-colors ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300'
            }`}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${
              isVideoEnabled
                ? 'bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={handleLeave}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
            aria-label="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

