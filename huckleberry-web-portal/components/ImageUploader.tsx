"use client";
import { useState, useEffect, useCallback } from "react";
import { processImage } from "@/lib/imageCompression";

type Props = {
  mentorshipId: string;
  sessionNoteId?: string;
  onUpload?: () => void;
  currentImageCount?: number; // Current number of images for this session (optional, will fetch if not provided)
  imageLimit?: number; // Maximum images allowed (75 for non-admins, unlimited for admins)
  isAdmin?: boolean; // Whether user is admin (unlimited uploads)
};

type ProcessedFile = {
  original: File;
  compressed: File;
  thumbnail: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
  thumbnailSize: number;
  processing: boolean;
  error?: string;
};

export function ImageUploader({ 
  mentorshipId, 
  sessionNoteId, 
  onUpload,
  currentImageCount,
  imageLimit = 75,
  isAdmin = false
}: Props) {
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageCount, setImageCount] = useState(currentImageCount ?? 0);
  const [loadingCount, setLoadingCount] = useState(currentImageCount === undefined);

  // Fetch image count if not provided
  useEffect(() => {
    if (currentImageCount !== undefined) {
      setImageCount(currentImageCount);
      setLoadingCount(false);
    } else {
      // Fetch count from API
      const params = new URLSearchParams({ mentorshipId });
      if (sessionNoteId) {
        params.append("sessionNoteId", sessionNoteId);
      }
      
      fetch(`/api/images/count?${params.toString()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          setImageCount(data.count || 0);
          setLoadingCount(false);
        })
        .catch((error) => {
          console.error("Failed to fetch image count:", error);
          setLoadingCount(false);
        });
    }
  }, [mentorshipId, sessionNoteId, currentImageCount]);

  // Refresh count from API (always fetch fresh count)
  const refreshCount = useCallback(() => {
    const params = new URLSearchParams({ mentorshipId });
    if (sessionNoteId) {
      params.append("sessionNoteId", sessionNoteId);
    }
    
    fetch(`/api/images/count?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setImageCount(data.count || 0);
      })
      .catch((error) => {
        console.error("Failed to refresh image count:", error);
      });
  }, [mentorshipId, sessionNoteId]);

  // Refresh count when page becomes visible (to catch deletions from other tabs/components)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshCount();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshCount]);

  const canUploadMore = isAdmin || imageCount < imageLimit;
  const remainingSlots = isAdmin ? Infinity : Math.max(0, imageLimit - imageCount);

  async function processFiles(files: File[]) {
    const newProcessedFiles: ProcessedFile[] = [];

    for (const file of files) {
      // Create preview URL
      const preview = URL.createObjectURL(file);
      
      // Add placeholder while processing
      const placeholder: ProcessedFile = {
        original: file,
        compressed: file,
        thumbnail: file,
        preview,
        originalSize: file.size,
        compressedSize: file.size,
        thumbnailSize: file.size,
        processing: true,
      };
      newProcessedFiles.push(placeholder);
      setProcessedFiles((prev) => [...prev, placeholder]);

      try {
        // Process image (compress + generate thumbnail)
        const processed = await processImage(file);
        
        // Update the processed file
        setProcessedFiles((prev) => 
          prev.map((pf) => 
            pf.original === file
              ? {
                  ...pf,
                  compressed: processed.compressed,
                  thumbnail: processed.thumbnail,
                  originalSize: processed.originalSize,
                  compressedSize: processed.compressedSize,
                  thumbnailSize: processed.thumbnailSize,
                  processing: false,
                }
              : pf
          )
        );
      } catch (error) {
        console.error('Error processing image:', error);
        setProcessedFiles((prev) =>
          prev.map((pf) =>
            pf.original === file
              ? {
                  ...pf,
                  processing: false,
                  error: error instanceof Error ? error.message : 'Failed to process image',
                }
              : pf
          )
        );
      }
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && canUploadMore) {
      const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) {
        // Limit files based on remaining slots
        const filesToProcess = isAdmin ? files : files.slice(0, remainingSlots);
        processFiles(filesToProcess);
        
        if (!isAdmin && files.length > remainingSlots) {
          alert(`Only ${remainingSlots} more image(s) can be uploaded (${imageLimit} total limit shared across all sessions). ${files.length - remainingSlots} file(s) were not added.`);
        }
      }
    }
    // Reset input
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    
    if (!canUploadMore) {
      alert(`Image limit reached (${imageLimit} images shared across all sessions). Please delete some images before uploading more.`);
      return;
    }

    const dropped = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    if (dropped.length > 0) {
      // Limit files based on remaining slots
      const filesToProcess = isAdmin ? dropped : dropped.slice(0, remainingSlots);
      processFiles(filesToProcess);
      
      if (!isAdmin && dropped.length > remainingSlots) {
        alert(`Only ${remainingSlots} more image(s) can be uploaded (${imageLimit} total limit shared across all sessions). ${dropped.length - remainingSlots} file(s) were not added.`);
      }
    }
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (canUploadMore) {
      setDragging(true);
    }
  }

  function onDragLeave() {
    setDragging(false);
  }

  function removeFile(index: number) {
    setProcessedFiles((prev) => {
      const file = prev[index];
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleUpload() {
    if (processedFiles.length === 0) return;
    
    // Check if any files are still processing
    const stillProcessing = processedFiles.some((pf) => pf.processing);
    if (stillProcessing) {
      alert("Please wait for images to finish processing before uploading.");
      return;
    }

    // Check if any files have errors
    const hasErrors = processedFiles.some((pf) => pf.error);
    if (hasErrors) {
      alert("Some images failed to process. Please remove them and try again.");
      return;
    }

    // Check limit again before upload
    if (!isAdmin && imageCount + processedFiles.length > imageLimit) {
      alert(`Upload would exceed the limit of ${imageLimit} images (shared across all sessions). Please remove some files.`);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("mentorshipId", mentorshipId);
      if (sessionNoteId) form.append("sessionNoteId", sessionNoteId);
      
      // Append both compressed and thumbnail for each file
      processedFiles.forEach((pf) => {
        form.append("compressed", pf.compressed);
        form.append("thumbnails", pf.thumbnail);
        form.append("originalSizes", pf.originalSize.toString());
        form.append("compressedSizes", pf.compressedSize.toString());
        form.append("thumbnailSizes", pf.thumbnailSize.toString());
      });

      const res = await fetch("/api/images/upload", { method: "POST", body: form });
      
      if (res.ok) {
        const data = await res.json();
        // Clean up preview URLs
        processedFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
        setProcessedFiles([]);
        
        // Always refresh count from API to ensure accuracy
        refreshCount();
        
        if (onUpload) {
          onUpload();
        }
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.error || "Failed to upload images");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload images. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border border-gray-200 dark:border-neutral-900 rounded-md p-4 bg-white dark:bg-neutral-950">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-900 dark:text-white">Upload Images</div>
        {!isAdmin && (
          <div className="flex items-center gap-3">
            {loadingCount ? (
              <div className="px-3 py-1.5 rounded-md font-semibold text-sm bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
                Loading...
              </div>
            ) : (
              <div className={`px-3 py-1.5 rounded-md font-semibold text-sm ${
                remainingSlots > 5
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : remainingSlots > 0
                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              }`}>
                {imageCount}/{imageLimit} images (shared across all sessions)
                {remainingSlots > 0 && ` • ${remainingSlots} remaining`}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div
        className={`rounded-lg border-2 border-dashed p-12 text-center transition-all ${
          canUploadMore
            ? dragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-400 scale-[1.02] cursor-pointer"
              : "border-gray-300 dark:border-neutral-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-neutral-900/50 cursor-pointer"
            : "border-gray-200 dark:border-neutral-800 opacity-50 cursor-not-allowed"
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => canUploadMore && document.getElementById(`file-input-${mentorshipId}`)?.click()}
      >
        <div className="space-y-3">
          {canUploadMore ? (
            <>
              <p className="text-base font-medium text-gray-700 dark:text-neutral-300">
                Drag and drop images here
              </p>
              <p className="text-sm text-gray-500 dark:text-neutral-500">
                or click to browse files
              </p>
              <p className="text-xs text-gray-400 dark:text-neutral-600 mt-2">
                Images will be compressed automatically
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-gray-500 dark:text-neutral-400">
                Image limit reached ({imageLimit} images shared across all sessions)
              </p>
              <p className="text-sm text-gray-400 dark:text-neutral-600">
                Delete some images to upload more
              </p>
            </>
          )}
        </div>
        <input 
          id={`file-input-${mentorshipId}`}
          type="file" 
          multiple 
          accept="image/*" 
          onChange={onFileChange} 
          disabled={!canUploadMore}
          className="hidden"
        />
      </div>
      
      {processedFiles.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {processedFiles.map((pf, i) => (
              <div key={i} className="relative">
                {pf.processing ? (
                  <div className="w-full h-24 rounded border border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-900 flex items-center justify-center">
                    <div className="text-xs text-gray-500 dark:text-neutral-500">Processing...</div>
                  </div>
                ) : pf.error ? (
                  <div className="w-full h-24 rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                    <div className="text-xs text-red-600 dark:text-red-400 text-center px-1">Error</div>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={pf.preview} 
                    alt={`Preview ${i + 1}`} 
                    className="w-full h-24 object-cover rounded border border-gray-200 dark:border-neutral-800" 
                  />
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs flex items-center justify-center"
                  title="Remove"
                >
                  ×
                </button>
                {pf.processing && (
                  <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded">
                    Compressing...
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button 
              onClick={handleUpload} 
              disabled={uploading || processedFiles.some((pf) => pf.processing || pf.error)}
              className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading..." : `Upload ${processedFiles.length} file(s)`}
            </button>
            {processedFiles.length > 0 && (
              <button
                onClick={() => {
                  processedFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
                  setProcessedFiles([]);
                }}
                className="text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200"
              >
                Clear all
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

