// hooks/useAgoraVideoCall.ts
// Agora SDK integration hook for video calling

import { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { ENV_CONFIG } from '@/src/config/environment';

export type AgoraCallState = 'idle' | 'joining' | 'joined' | 'leaving' | 'error';

// Use 'any' for Agora types to avoid TypeScript namespace issues
// The types are available at runtime from the Agora SDK
type IAgoraRTCClient = any;
type ILocalVideoTrack = any;
type ILocalAudioTrack = any;
type IRemoteUser = any;

export interface AgoraVideoCallConfig {
  appId: string;
  channelName: string;
  token: string;
  userId: string;
  onUserJoined?: (client: IAgoraRTCClient) => void;
  onUserLeft?: (client: IAgoraRTCClient) => void;
  onError?: (error: Error) => void;
}

export function useAgoraVideoCall(config: AgoraVideoCallConfig) {
  const [callState, setCallState] = useState<AgoraCallState>('idle');
  const [localVideoTrack, setLocalVideoTrack] = useState<ILocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IRemoteUser[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const configRef = useRef(config);
  const localAudioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ILocalVideoTrack | null>(null);
  const isJoiningRef = useRef(false);
  const isLeavingRef = useRef(false);

  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Update track refs when tracks change
  useEffect(() => {
    localAudioTrackRef.current = localAudioTrack;
  }, [localAudioTrack]);

  useEffect(() => {
    localVideoTrackRef.current = localVideoTrack;
  }, [localVideoTrack]);

  // Initialize Agora client (only once on mount)
  useEffect(() => {
    // Read directly from process.env to ensure we get the latest value
    // NEXT_PUBLIC_ variables are available in client components
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID;
    
    // Debug: log the value (will be empty string if not set)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Agora] App ID configured:', appId ? 'Yes' : 'No', appId ? `(length: ${appId.length})` : '');
      console.log('[Agora] From process.env:', process.env.NEXT_PUBLIC_AGORA_APP_ID ? 'Yes' : 'No');
      console.log('[Agora] From ENV_CONFIG:', ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID ? 'Yes' : 'No');
    }
    
    if (!appId || appId.trim() === '') {
      setError(new Error('Agora App ID is not configured. Please check your .env.local file and restart the dev server.'));
      setCallState('error');
      return;
    }

    // Create Agora client
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;
    setIsClientReady(true);

    // Set up event handlers
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        setRemoteUsers((prev) => {
          if (prev.find((u) => u.uid === user.uid)) {
            return prev;
          }
          return [...prev, user];
        });
      }

      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      }
    });

    client.on('user-left', (user) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      configRef.current.onUserLeft?.(client);
    });

    client.on('user-joined', () => {
      configRef.current.onUserJoined?.(client);
    });

    return () => {
      // Cleanup on unmount
      if (clientRef.current) {
        clientRef.current.leave().catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Join channel
  const joinChannel = useCallback(async () => {
    if (!clientRef.current) {
      setError(new Error('Agora client not initialized'));
      setCallState('error');
      return;
    }

    // Prevent multiple simultaneous join attempts
    if (isJoiningRef.current || isLeavingRef.current) {
      console.log('[Agora] Already joining or leaving, skipping');
      return;
    }

    // Check if already joined
    if (callState === 'joined' || callState === 'joining') {
      console.log('[Agora] Already joined or joining, skipping');
      return;
    }

    const currentConfig = configRef.current;
    let audioTrack: ILocalAudioTrack | null = null;
    let videoTrack: ILocalVideoTrack | null = null;

    try {
      isJoiningRef.current = true;
      setCallState('joining');
      setError(null);

      // Get local tracks
      [audioTrack, videoTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack(),
      ]);

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      setIsVideoEnabled(true);
      setIsMuted(false);

      // Join channel with token
      await clientRef.current.join(
        currentConfig.appId,
        currentConfig.channelName,
        currentConfig.token,
        currentConfig.userId
      );

      // Publish local tracks
      await clientRef.current.publish([audioTrack, videoTrack]);

      setCallState('joined');
      isJoiningRef.current = false;
    } catch (err) {
      isJoiningRef.current = false;
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setCallState('error');
      currentConfig.onError?.(error);
      
      // Cleanup on error - close the tracks we just created
      if (audioTrack) {
        audioTrack.close();
      }
      if (videoTrack) {
        videoTrack.close();
      }
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
    }
  }, [callState]); // Include callState to check if already joined

  // Leave channel
  const leaveChannel = useCallback(async () => {
    if (!clientRef.current) {
      return;
    }

    // Prevent multiple simultaneous leave attempts
    if (isLeavingRef.current) {
      console.log('[Agora] Already leaving, skipping');
      return;
    }

    // If we're still joining, wait a bit for it to complete or fail
    if (isJoiningRef.current) {
      console.log('[Agora] Still joining, waiting before leaving...');
      // Wait up to 5 seconds for join to complete
      let waitCount = 0;
      while (isJoiningRef.current && waitCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
    }

    try {
      isLeavingRef.current = true;
      setCallState('leaving');

      // Get current tracks from state (we'll use a ref to access current values)
      setLocalAudioTrack((currentAudio: ILocalAudioTrack | null) => {
        if (currentAudio) {
          currentAudio.stop();
          currentAudio.close();
        }
        return null;
      });
      setLocalVideoTrack((currentVideo: ILocalVideoTrack | null) => {
        if (currentVideo) {
          currentVideo.stop();
          currentVideo.close();
        }
        return null;
      });

      // Leave channel
      await clientRef.current.leave();
      setRemoteUsers([]);
      setCallState('idle');
      isLeavingRef.current = false;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      configRef.current.onError?.(error);
      isLeavingRef.current = false;
    }
  }, []); // No dependencies - uses state setters with functional updates

  // Toggle mute
  const toggleMute = useCallback(async () => {
    const currentAudioTrack = localAudioTrackRef.current;
    if (!currentAudioTrack) return;

    try {
      if (isMuted) {
        await currentAudioTrack.setEnabled(true);
        setIsMuted(false);
      } else {
        await currentAudioTrack.setEnabled(false);
        setIsMuted(true);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      configRef.current.onError?.(error);
    }
  }, [isMuted]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    const currentVideoTrack = localVideoTrackRef.current;
    if (!currentVideoTrack) return;

    try {
      if (isVideoEnabled) {
        await currentVideoTrack.setEnabled(false);
        setIsVideoEnabled(false);
      } else {
        await currentVideoTrack.setEnabled(true);
        setIsVideoEnabled(true);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      configRef.current.onError?.(error);
    }
  }, [isVideoEnabled]);

  return {
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
  };
}

