import imageCompression from 'browser-image-compression';

const MAX_FILE_SIZE_MB = 10; // Max file size before compression (10MB)
const COMPRESSED_MAX_SIZE_MB = 1; // Target max size after compression (1MB)
const THUMBNAIL_MAX_DIMENSION = 300; // Max dimension for thumbnails

/**
 * Compress an image file to reduce size
 * Converts to WebP format for optimal compression
 */
export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: COMPRESSED_MAX_SIZE_MB,
    maxWidthOrHeight: 1920, // Max dimension for compressed image
    useWebWorker: true,
    fileType: 'image/webp', // Convert to WebP for better compression
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    // If compression fails, return original file
    return file;
  }
}

/**
 * Generate a thumbnail from an image file
 * Returns a File object with the thumbnail
 */
export async function generateThumbnail(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.1, // Thumbnails should be very small
    maxWidthOrHeight: THUMBNAIL_MAX_DIMENSION,
    useWebWorker: true,
    fileType: 'image/webp',
  };

  try {
    const thumbnail = await imageCompression(file, options);
    return thumbnail;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    // If thumbnail generation fails, return a compressed version
    return compressImage(file);
  }
}

/**
 * Process an image file: compress it and generate a thumbnail
 * Returns both the compressed original and thumbnail
 */
export async function processImage(file: File): Promise<{
  compressed: File;
  thumbnail: File;
  originalSize: number;
  compressedSize: number;
  thumbnailSize: number;
}> {
  // Check if file is too large before compression
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE_MB}MB`);
  }

  // Compress the original image
  const compressed = await compressImage(file);
  
  // Generate thumbnail from original (before compression for better quality)
  const thumbnail = await generateThumbnail(file);

  return {
    compressed,
    thumbnail,
    originalSize: file.size,
    compressedSize: compressed.size,
    thumbnailSize: thumbnail.size,
  };
}

