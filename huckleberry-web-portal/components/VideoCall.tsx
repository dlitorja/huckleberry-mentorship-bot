"use client";
// components/VideoCall.tsx
// Main video call component with Agora SDK integration

import { useEffect, useRef } from 'react';
import { useAgoraVideoCall } from '@/hooks/useAgoraVideoCall';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Circle, Square, CircleDot } from 'lucide-react';

interface VideoCallProps {
  appId: string;
  channelName: string;
  token: string;
  userId: string;
  onLeave?: () => void;
  onError?: (error: Error) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  isRecording?: boolean;
  isRecordingStarting?: boolean;
}

export function VideoCall({
  appId,
  channelName,
  token,
  userId,
  onLeave,
  onError,
  onRecordingStart,
  onRecordingStop,
  isRecording = false,
  isRecordingStarting = false,
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
    // Only render video if call is joined and we have a track
    if (!localVideoTrack || !localVideoRef.current || callState !== 'joined') {
      return;
    }

    const container = localVideoRef.current;
    let retryCount = 0;
    const maxRetries = 5; // Increased retries
    let isCleanedUp = false;

    const playVideo = async () => {
      if (isCleanedUp) return;

      try {
        // Ensure video track is enabled based on isVideoEnabled state
        if (localVideoTrack.setEnabled) {
          await localVideoTrack.setEnabled(isVideoEnabled);
        }

        // Only play if video is enabled
        if (!isVideoEnabled) {
          // Remove video element if disabled
          const existingVideo = container.querySelector('video');
          if (existingVideo) {
            existingVideo.remove();
          }
          try {
            localVideoTrack.stop();
          } catch (err) {
            // Ignore errors when stopping
          }
          return;
        }

        // Clear any existing video elements first
        const existingVideos = container.querySelectorAll('video');
        existingVideos.forEach(v => v.remove());

        // Wait a bit for track to be fully ready and container to be mounted
        await new Promise(resolve => setTimeout(resolve, 200));

        // Ensure container is in the DOM
        if (!container.isConnected) {
          console.warn('[VideoCall] Container not in DOM yet, waiting...');
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(playVideo, 300);
            return;
          }
        }

        // Try to use play() method first (Agora's preferred way)
        let videoElement = container.querySelector('video');
        
        if (!videoElement) {
          try {
            // Ensure track is enabled before playing
            if (localVideoTrack.setEnabled) {
              await localVideoTrack.setEnabled(true);
            }
            
            const playResult = localVideoTrack.play(container);
            if (playResult && typeof playResult.then === 'function') {
              await playResult;
            }
            // Wait a bit for play() to create the element
            await new Promise(resolve => setTimeout(resolve, 300));
            videoElement = container.querySelector('video');
          } catch (playErr) {
            console.log('[VideoCall] play() method failed, will create element manually:', playErr);
          }
        }

        // If play() didn't create an element, create it manually
        if (!videoElement && localVideoTrack.getMediaStreamTrack) {
          console.log('[VideoCall] Creating video element manually');
          const stream = new MediaStream([localVideoTrack.getMediaStreamTrack()]);
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true; // Mute local video to prevent feedback
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          container.appendChild(video);
          
          // Try to play the video element
          try {
            await video.play();
          } catch (playErr) {
            console.warn('[VideoCall] Video element play() failed:', playErr);
          }
          
          videoElement = video;
        }

        // Style the video element if it exists
        if (videoElement) {
          (videoElement as HTMLVideoElement).style.width = '100%';
          (videoElement as HTMLVideoElement).style.height = '100%';
          (videoElement as HTMLVideoElement).style.objectFit = 'cover';
          (videoElement as HTMLVideoElement).style.display = 'block';
          console.log('[VideoCall] Video element ready');
        } else if (retryCount < maxRetries) {
          // Retry if video element still not found
          retryCount++;
          console.log(`[VideoCall] Video element not found, retrying (${retryCount}/${maxRetries})...`);
          setTimeout(playVideo, 400);
        } else {
          console.warn('[VideoCall] Video element not found after retries');
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[VideoCall] Failed to play local video:', error);
        
        // Retry on error if we haven't exceeded max retries
        if (retryCount < maxRetries && !isCleanedUp) {
          retryCount++;
          console.log(`[VideoCall] Error playing video, retrying (${retryCount}/${maxRetries})...`);
          setTimeout(playVideo, 500);
        } else {
          onError?.(error);
        }
      }
    };

    // Start playing video
    playVideo();

    return () => {
      isCleanedUp = true;
      // Don't stop the track on cleanup - let toggleVideo handle that
    };
  }, [localVideoTrack, isVideoEnabled, callState, onError]);

  // Render remote videos
  useEffect(() => {
    remoteUsers.forEach((user) => {
      if (user.videoTrack) {
        const container = remoteVideoRefs.current.get(user.uid);
        if (container) {
          try {
            const playResult = user.videoTrack.play(container);
            // Handle if play() returns a Promise
            if (playResult && typeof playResult.then === 'function') {
              playResult
                .then(() => {
                  // Style the video element after it's created
                  setTimeout(() => {
                    const videoElement = container.querySelector('video');
                    if (videoElement) {
                      videoElement.style.width = '100%';
                      videoElement.style.height = '100%';
                      videoElement.style.objectFit = 'cover';
                    }
                  }, 100);
                })
                .catch((err: Error) => {
                  console.error(`[VideoCall] Failed to play remote video for user ${user.uid}:`, err);
                });
            } else {
              // play() is synchronous, style after a delay
              setTimeout(() => {
                const videoElement = container.querySelector('video');
                if (videoElement) {
                  videoElement.style.width = '100%';
                  videoElement.style.height = '100%';
                  videoElement.style.objectFit = 'cover';
                }
              }, 100);
            }
          } catch (err) {
            console.error(`[VideoCall] Error playing remote video for user ${user.uid}:`, err);
          }
        }
      }
    });

    return () => {
      remoteUsers.forEach((user) => {
        try {
          user.videoTrack?.stop();
        } catch (err) {
          console.error(`[VideoCall] Error stopping remote video for user ${user.uid}:`, err);
        }
      });
    };
  }, [remoteUsers]);

  const handleLeave = async () => {
    await leaveChannel();
    onLeave?.();
  };

  const handleRecordingToggle = async () => {
    if (isRecording) {
      await onRecordingStop?.();
    } else {
      await onRecordingStart?.();
    }
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
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '200px' }}>
          <div
            ref={localVideoRef}
            className="w-full h-full"
            style={{
              minHeight: '200px',
              width: '100%',
              height: '100%',
              position: 'relative',
              backgroundColor: '#000'
            }}
          />
          {!localVideoTrack && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-400">Loading camera...</p>
              </div>
            </div>
          )}
          {localVideoTrack && !isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
              <div className="text-center">
                <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Camera Off</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-20">
            You {isMuted && '(Muted)'}
            {isRecording && (
              <span className="ml-2 flex items-center">
                <Circle className="w-3 h-3 text-red-500 animate-pulse mr-1" />
                REC
              </span>
            )}
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
                {isRecording && (
                  <span className="ml-2 flex items-center">
                    <Circle className="w-2 h-2 text-red-500 animate-pulse mr-1" />
                    REC
                  </span>
                )}
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

          {/* Recording Controls */}
          <button
            onClick={handleRecordingToggle}
            disabled={isRecordingStarting}
            className={`p-3 rounded-full transition-colors ${
              isRecording
                ? 'animate-pulse bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300'
            } ${
              isRecordingStarting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecordingStarting ? (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : isRecording ? (
              <Square className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
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

