// lib/agora/recording-service.ts
// Complete service for managing Agora cloud recording with Backblaze B2 storage

import { startCloudRecording, queryCloudRecording, stopCloudRecording, getDefaultStorageConfig } from './cloud-recording';
import { getBackblazeB2Config, uploadVideoToB2 } from '../storage/backblaze-b2';
import { getSupabaseClient } from '../supabase';
import { ENV_CONFIG } from '@/src/config/environment';

export interface RecordingSession {
  resourceId: string;
  uid: string;
  channelName: string;
  callId: string;
  startTime: Date;
  bucket: string;
  objectKey: string;
}

interface RecordingInfo {
  sid: string; // Session ID assigned by Agora cloud recording
  recordingServerVersion: string;
  fileListMode: string;
  fileList: Array<{
    fileName: string;
    trackType: string; // 'audio' or 'video'
    uid: string;
    mixedAllUser: boolean;
    isPlayable: boolean;
    sliceStartTime: number; // Unix timestamp in milliseconds
  }>;
  status: number; // 0: recording in progress, 1: recording stopped
}

// Store active recording sessions in memory (in production, use Redis or DB)
const activeRecordings = new Map<string, RecordingSession>();

export class RecordingService {
  private static instance: RecordingService;
  private agoraAppId: string;
  private agoraCertificate: string;

  private constructor() {
    this.agoraAppId = ENV_CONFIG.NEXT_PUBLIC_AGORA_APP_ID || '';
    this.agoraCertificate = ENV_CONFIG.AGORA_APP_CERTIFICATE || '';
  }

  public static getInstance(): RecordingService {
    if (!RecordingService.instance) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  /**
   * Start a cloud recording for a video call
   */
  async startRecording(
    callId: string,
    channelName: string,
    uid: string,
  ): Promise<{ success: boolean; resourceId?: string; error?: string }> {
    try {
      // Validate that agora credentials are configured
      if (!this.agoraAppId || !this.agoraCertificate) {
        throw new Error('Agora credentials not configured');
      }

      // Log credential info for debugging (first 8 chars only for security)
      console.log('[Recording Service] Using App ID:', this.agoraAppId.substring(0, 8) + '...');
      console.log('[Recording Service] Using Certificate:', this.agoraCertificate.substring(0, 8) + '...');
      console.log('[Recording Service] Certificate length:', this.agoraCertificate.length);

      // Get storage configuration for Backblaze B2
      const storageConfig = getDefaultStorageConfig();
      if (!storageConfig) {
        throw new Error('Backblaze B2 storage configuration not found');
      }

      // Start the cloud recording
      const agoraConfig = {
        appId: this.agoraAppId,
        appCertificate: this.agoraCertificate,
        uid: uid,
      };

      const recordingResource = await startCloudRecording(
        channelName,
        uid,
        agoraConfig,
        storageConfig
      );

      if (!recordingResource) {
        throw new Error('Failed to start cloud recording');
      }

      // Create a recording session object
      const recordingSession: RecordingSession = {
        resourceId: recordingResource.resourceId,
        uid: recordingResource.uid,
        channelName: recordingResource.cname,
        callId,
        startTime: new Date(),
        bucket: storageConfig.bucket,
        objectKey: `recordings/${callId}/${Date.now()}.mp4`,
      };

      // Store the active recording
      activeRecordings.set(recordingResource.resourceId, recordingSession);

      // Update the call record to indicate recording is in progress
      const supabase = getSupabaseClient(true);
      const { error } = await supabase
        .from('video_calls')
        .update({
          recording_status: 'recording',
          recording_key: recordingSession.objectKey,
          recording_metadata: {
            agoraResourceId: recordingResource.resourceId,
            uid: recordingResource.uid,
            channelName: recordingResource.cname,
            startTime: recordingSession.startTime.toISOString(),
          }
        })
        .eq('id', callId);

      if (error) {
        console.error('Error updating call record:', error);
        // Remove the recording from active recordings since the DB update failed
        activeRecordings.delete(recordingResource.resourceId);
        return { success: false, error: 'Failed to update call record' };
      }

      return {
        success: true,
        resourceId: recordingResource.resourceId
      };
    } catch (error) {
      console.error('Error starting recording:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Stop a cloud recording for a video call
   */
  async stopRecording(
    resourceId: string,
    uid: string,
  ): Promise<{ success: boolean; recordingInfo?: RecordingInfo; error?: string }> {
    try {
      const recordingSession = activeRecordings.get(resourceId);
      if (!recordingSession) {
        return { success: false, error: 'Recording session not found' };
      }

      // Stop the cloud recording
      const agoraConfig = {
        appId: this.agoraAppId,
        appCertificate: this.agoraCertificate,
        uid: uid,
      };

      const recordingInfo = await stopCloudRecording(
        resourceId,
        'mix',
        uid,
        agoraConfig
      );

      if (!recordingInfo) {
        throw new Error('Failed to stop cloud recording');
      }

      // Query the recording to get file info
      const queryResult = await queryCloudRecording(resourceId, 'mix', uid, agoraConfig);
      if (queryResult && queryResult.fileList) {
        // In a real implementation, we would now have the recording file paths in the storage
        // For now, we'll update the call record as recorded
        const supabase = getSupabaseClient(true);
        const { error } = await supabase
          .from('video_calls')
          .update({
            recording_status: 'recorded',
            recording_url: `${getBackblazeB2Config()?.endpoint}/file/${getBackblazeB2Config()?.bucketName}/${recordingSession.objectKey}`,
            recording_duration_seconds: Math.floor((Date.now() - recordingSession.startTime.getTime()) / 1000),
          })
          .eq('id', recordingSession.callId);

        if (error) {
          console.error('Error updating call record after recording:', error);
          return { success: false, error: 'Failed to update call record' };
        }
      }

      // Remove from active recordings
      activeRecordings.delete(resourceId);

      return { success: true, recordingInfo };
    } catch (error) {
      console.error('Error stopping recording:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Handle recording cleanup when a call ends without properly stopping recording
   */
  async cleanupRecording(resourceId: string, uid: string): Promise<boolean> {
    try {
      const recordingSession = activeRecordings.get(resourceId);
      if (!recordingSession) {
        return true; // Nothing to clean up
      }

      // Stop the recording if it's still active
      const agoraConfig = {
        appId: this.agoraAppId,
        appCertificate: this.agoraCertificate,
        uid: uid,
      };

      await stopCloudRecording(resourceId, 'mix', uid, agoraConfig);

      // Update the call record to mark recording as failed
      const supabase = getSupabaseClient(true);
      await supabase
        .from('video_calls')
        .update({
          recording_status: 'failed',
        })
        .eq('id', recordingSession.callId);

      // Remove from active recordings
      activeRecordings.delete(resourceId);

      return true;
    } catch (error) {
      console.error('Error cleaning up recording:', error);
      return false;
    }
  }

  /**
   * Get the status of a recording
   */
  async getRecordingStatus(resourceId: string, uid: string): Promise<{ status: string; info?: any; error?: string } | null> {
    try {
      const recordingSession = activeRecordings.get(resourceId);
      if (!recordingSession) {
        return null;
      }

      const agoraConfig = {
        appId: this.agoraAppId,
        appCertificate: this.agoraCertificate,
        uid: uid,
      };

      const info = await queryCloudRecording(resourceId, 'mix', uid, agoraConfig);
      if (!info) {
        return { status: 'error', error: 'Failed to query recording status' };
      }

      return { status: info.status === 0 ? 'recording' : 'stopped', info };
    } catch (error) {
      console.error('Error getting recording status:', error);
      return { status: 'error', error: (error as Error).message };
    }
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings(): RecordingSession[] {
    return Array.from(activeRecordings.values());
  }
}