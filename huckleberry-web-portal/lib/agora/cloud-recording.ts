// lib/agora/cloud-recording.ts
// Agora cloud recording service with S3-compatible storage (Backblaze B2 / Cloudflare R2)

import axios from 'axios';
import { ENV_CONFIG } from '@/src/config/environment';

export interface CloudRecordingConfig {
  appId: string;
  appCertificate: string;
  uid: string; // User ID (can be a string for agora's cloud recording)
}

export interface RecordingResource {
  resourceId: string;
  uid: string;
  cname: string;
}

export interface RecordingStartParams {
  resourceid: string;
  mode: 'individual' | 'mix' | 'stream'; // 'individual': record each user separately, 'mix': mix all streams, 'stream': for RTMP streaming
  uid: string;
  clientRequest: {
    recordingConfig: {
      channelType: number; // 0 for communication, 1 for live broadcast
      streamTypes: number; // 1 for audio only, 2 for video only, 3 for audio and video
      subscribeUidGroup?: number; // 0, 1, 2, or 3
      subscribeVideoUids?: string[]; // Specific UIDs to record
      subscribeAudioUids?: string[]; // Specific UIDs to record
      transcodingConfig?: {
        width: number;
        height: number;
        fps: number;
        bitrate: number;
        mixedVideoLayout: number;
        backgroundColor: number; // RGB in decimal (e.g., black is 0x000000 = 0)
        layoutConfig?: Array<{
          x_axis: number;
          y_axis: number;
          width: number;
          height: number;
          uid: string;
          alpha?: number;
          render_mode?: number;
        }>;
      };
      storageConfig?: {
        vendor: number; // 1 for AWS S3, 2 for Alibaba Cloud, 3 for Qiniu Cloud, 4 for Upyun, 5 for Netease Cloud, 17 for Backblaze (treated as S3-compatible)
        region: number;
        bucket: string;
        accessKey: string;
        secretKey: string;
        fileNamePrefix?: string[]; // E.g., ['huckleberry', 'recordings', 'mentorshipId']
      };
    };
  };
}

export interface RecordingQueryParams {
  resourceid: string;
  mode: 'individual' | 'mix' | 'stream';
  uid: string;
}

export interface RecordingStopParams {
  resourceid: string;
  mode: 'individual' | 'mix' | 'stream';
  uid: string;
}

/**
 * Start an Agora cloud recording session
 */
export async function startCloudRecording(
  channelName: string,
  uid: string,
  agoraConfig: CloudRecordingConfig,
  storageConfig?: {
    vendor: number; // For Backblaze B2, use 1 (AWS S3 compatible) or 17 if supported
    region: number;
    bucket: string;
    accessKey: string;
    secretKey: string;
    fileNamePrefix?: string[];
  }
): Promise<RecordingResource | null> {
  try {
    // Validate credentials before making request
    if (!agoraConfig.appId || !agoraConfig.appCertificate) {
      throw new Error('Agora App ID or Certificate is missing');
    }

    // First, acquire a resource ID
    const acquireUrl = `https://api.agora.io/v1/apps/${agoraConfig.appId}/cloud_recording/acquire`;
    
    // Create Basic auth header
    const authString = `${agoraConfig.appId}:${agoraConfig.appCertificate}`;
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
    
    // Log auth details for debugging (first few chars only)
    console.log('[Cloud Recording] Auth App ID:', agoraConfig.appId.substring(0, 8) + '...');
    console.log('[Cloud Recording] Auth URL:', acquireUrl);
    console.log('[Cloud Recording] Channel name:', channelName);
    console.log('[Cloud Recording] UID:', uid, '(type:', typeof uid + ')');
    console.log('[Cloud Recording] Auth string length:', authString.length);
    console.log('[Cloud Recording] Auth header length:', authHeader.length);
    
    // Agora Cloud Recording API - UID can be string or number
    // For very long Discord IDs, we'll use it as a string
    // But Agora might prefer a numeric UID for recording - try converting if it's a valid number
    let recordingUid: string | number = String(uid);
    
    // Try to use numeric UID if the string represents a valid number
    // Agora Cloud Recording typically uses numeric UIDs (0-2^32-1)
    // But Discord IDs are often too large, so we'll keep as string
    const numericUid = Number(uid);
    if (!isNaN(numericUid) && numericUid >= 0 && numericUid <= 2147483647) {
      // Valid numeric UID within Agora's range
      recordingUid = numericUid;
      console.log('[Cloud Recording] Using numeric UID:', recordingUid);
    } else {
      console.log('[Cloud Recording] Using string UID (Discord ID too large for numeric)');
    }
    
    const acquireResponse = await axios.post(
      acquireUrl,
      {
        cname: channelName,
        uid: recordingUid,
        clientRequest: {
          resourceExpiredHour: 24
        }
      },
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json;charset=utf-8',
        }
      }
    );

    if (acquireResponse.status !== 200) {
      const errorData = acquireResponse.data as any;
      const errorMessage = errorData?.message || errorData?.error || 'Unknown error';
      throw new Error(`Failed to acquire recording resource: ${acquireResponse.status} - ${errorMessage}`);
    }

    const responseData = acquireResponse.data as any;
    const resourceId = responseData.resourceId;
    
    // Then start the recording with the resource ID
    const startUrl = `https://api.agora.io/v1/apps/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;
    
    const startRequest: RecordingStartParams = {
      resourceid: resourceId,
      mode: 'mix', // mix all streams together
      uid: uid,
      clientRequest: {
        recordingConfig: {
          channelType: 1, // live broadcast mode
          streamTypes: 3, // both audio and video
          transcodingConfig: {
            width: 640,
            height: 480,
            fps: 15,
            bitrate: 500,
            mixedVideoLayout: 1,
            backgroundColor: 0x000000,
          }
        }
      }
    };

    // Add storage configuration if provided
    if (storageConfig) {
      startRequest.clientRequest.recordingConfig.storageConfig = storageConfig;
    }

    const startResponse = await axios.post(
      startUrl,
      startRequest.clientRequest,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${agoraConfig.appId}:${agoraConfig.appCertificate}`).toString('base64')}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (startResponse.status !== 200) {
      throw new Error(`Failed to start recording: ${startResponse.status}`);
    }

    const startResponseData = startResponse.data as any;
    return {
      resourceId: startResponseData.resourceId,
      uid: startResponseData.uid,
      cname: channelName,
    };
  } catch (error: any) {
    console.error('Error starting cloud recording:', error);
    
    // Provide more detailed error information
    if (error.response) {
      // Axios error with response
      const status = error.response.status;
      const statusText = error.response.statusText;
      const errorData = error.response.data;
      
      console.error(`[Cloud Recording] HTTP ${status} ${statusText}:`, errorData);
      
      if (status === 401) {
        console.error('[Cloud Recording] 401 Unauthorized - Detailed Error:');
        console.error('  Status:', status);
        console.error('  Status Text:', statusText);
        console.error('  Error Data:', JSON.stringify(errorData, null, 2));
        console.error('  Request URL:', error.config?.url);
        console.error('  Request Method:', error.config?.method);
        console.error('  Auth Header Present:', !!error.config?.headers?.Authorization);
        console.error('  Possible causes:');
        console.error('    1. App Certificate is incorrect or expired');
        console.error('    2. App Certificate does not have Cloud Recording permissions');
        console.error('    3. App ID is incorrect');
        console.error('    4. Cloud Recording not fully enabled (wait 5-10 minutes)');
        console.error('    5. Certificate/App ID mismatch (from different projects)');
      }
    } else if (error.request) {
      // Request made but no response
      console.error('[Cloud Recording] No response from Agora API:', error.request);
    } else {
      // Error setting up request
      console.error('[Cloud Recording] Request setup error:', error.message);
    }
    
    return null;
  }
}

/**
 * Query the status of a running recording
 */
export async function queryCloudRecording(
  resourceId: string,
  mode: 'individual' | 'mix' | 'stream',
  uid: string,
  agoraConfig: CloudRecordingConfig
): Promise<any | null> {
  try {
    const queryUrl = `https://api.agora.io/v1/apps/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/mode/${mode}/query`;
    
    const response = await axios.get(
      queryUrl,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${agoraConfig.appId}:${agoraConfig.appCertificate}`).toString('base64')}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to query recording: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error('Error querying cloud recording:', error);
    return null;
  }
}

/**
 * Stop a running recording
 */
export async function stopCloudRecording(
  resourceId: string,
  mode: 'individual' | 'mix' | 'stream',
  uid: string,
  agoraConfig: CloudRecordingConfig
): Promise<any | null> {
  try {
    const stopUrl = `https://api.agora.io/v1/apps/${agoraConfig.appId}/cloud_recording/resourceid/${resourceId}/mode/${mode}/stop`;
    
    const stopRequest: RecordingStopParams = {
      resourceid: resourceId,
      mode: mode,
      uid: uid,
    };

    const response = await axios.post(
      stopUrl,
      {
        cname: agoraConfig.uid, // This should be the channel name actually
        uid: uid,
        clientRequest: {}
      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${agoraConfig.appId}:${agoraConfig.appCertificate}`).toString('base64')}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(`Failed to stop recording: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error('Error stopping cloud recording:', error);
    return null;
  }
}

/**
 * Get the default storage configuration for Backblaze B2
 */
export function getDefaultStorageConfig(): {
  vendor: number, // 1 for S3-compatible (like Backblaze B2)
  region: number,
  bucket: string,
  accessKey: string,
  secretKey: string,
  fileNamePrefix: string[],
} | null {
  const endpoint = ENV_CONFIG.BACKBLAZE_B2_ENDPOINT || process.env.BACKBLAZE_B2_ENDPOINT;
  const accessKeyId = ENV_CONFIG.BACKBLAZE_B2_ACCESS_KEY_ID || process.env.BACKBLAZE_B2_ACCESS_KEY_ID;
  const secretAccessKey = ENV_CONFIG.BACKBLAZE_B2_SECRET_ACCESS_KEY || process.env.BACKBLAZE_B2_SECRET_ACCESS_KEY;
  const bucketName = ENV_CONFIG.BACKBLAZE_B2_BUCKET_NAME || process.env.BACKBLAZE_B2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    console.warn('Backblaze B2 configuration is incomplete. Cloud recording with storage will be disabled.');
    return null;
  }

  // Extract region from B2 endpoint (e.g., from https://s3.us-west-004.backblazeb2.com)
  // For B2, the region is usually specified in the endpoint URL
  const endpointMatch = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/);
  const region = endpointMatch ? endpointMatch[1].replace(/-/g, '') : 'uswest004';

  return {
    vendor: 1, // AWS S3 compatible (works with Backblaze B2)
    region: 1, // Use 1 as default for S3-compatible services
    bucket: bucketName,
    accessKey: accessKeyId,
    secretKey: secretAccessKey,
    fileNamePrefix: ['huckleberry', 'recordings'],
  };
}