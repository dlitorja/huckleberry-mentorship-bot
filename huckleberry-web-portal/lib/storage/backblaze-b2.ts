// lib/storage/backblaze-b2.ts
// Backblaze B2 storage service with S3-compatible API

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV_CONFIG } from '@/src/config/environment';

export interface VideoStorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

/**
 * Get Backblaze B2 configuration from environment variables
 */
export function getBackblazeB2Config(): VideoStorageConfig | null {
  const endpoint = ENV_CONFIG.BACKBLAZE_B2_ENDPOINT || process.env.BACKBLAZE_B2_ENDPOINT;
  const accessKeyId = ENV_CONFIG.BACKBLAZE_B2_ACCESS_KEY_ID || process.env.BACKBLAZE_B2_ACCESS_KEY_ID;
  const secretAccessKey = ENV_CONFIG.BACKBLAZE_B2_SECRET_ACCESS_KEY || process.env.BACKBLAZE_B2_SECRET_ACCESS_KEY;
  const bucketName = ENV_CONFIG.BACKBLAZE_B2_BUCKET_NAME || process.env.BACKBLAZE_B2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    console.warn('Backblaze B2 configuration is incomplete. Video recording storage will be disabled.');
    return null;
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
  };
}

/**
 * Initialize S3 client for Backblaze B2
 */
export function initializeB2Client(): S3Client | null {
  const config = getBackblazeB2Config();
  if (!config) {
    return null;
  }

  return new S3Client({
    endpoint: config.endpoint,
    region: 'us-west-004', // Backblaze B2 uses region for authentication
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true, // Needed for Backblaze B2
  });
}

/**
 * Upload a video file to Backblaze B2
 */
export async function uploadVideoToB2(
  key: string,
  fileBuffer: Buffer | Uint8Array | Blob,
  contentType: string = 'video/mp4'
): Promise<string | null> {
  const client = initializeB2Client();
  if (!client) {
    throw new Error('Backblaze B2 client not initialized. Check configuration.');
  }

  const config = getBackblazeB2Config()!;

  try {
    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        uploadedAt: new Date().toISOString(),
        source: 'huckleberry-video-call',
      },
    });

    await client.send(command);

    // Return the public URL for the uploaded file
    // For Backblaze B2, this would be: https://f004.backblazeb2.com/file/{bucketName}/{key}
    const publicUrl = `${config.endpoint.replace('/s3', '')}/file/${config.bucketName}/${key}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading video to Backblaze B2:', error);
    throw new Error(`Failed to upload video: ${(error as Error).message}`);
  }
}

/**
 * Get a signed URL for accessing a video file (for temporary access)
 */
export async function getVideoSignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour by default
): Promise<string | null> {
  const client = initializeB2Client();
  if (!client) {
    return null;
  }

  const config = getBackblazeB2Config()!;

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Error getting signed URL from Backblaze B2:', error);
    return null;
  }
}

/**
 * Delete a video file from Backblaze B2
 */
export async function deleteVideoFromB2(key: string): Promise<boolean> {
  const client = initializeB2Client();
  if (!client) {
    return false;
  }

  const config = getBackblazeB2Config()!;

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting video from Backblaze B2:', error);
    return false;
  }
}