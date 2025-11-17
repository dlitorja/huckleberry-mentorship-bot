"use client";
import { useState, useEffect } from "react";
import { Trash2, X, ChevronLeft, ChevronRight, Check, CheckSquare, Square, Download, MessageSquare, Send } from "lucide-react";
import { useSession } from "next-auth/react";

type ImageItem = {
  id: string;
  image_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  uploader_type?: string;
  created_at?: string;
};

type Comment = {
  id: string;
  user_discord_id: string;
  user_type: string;
  comment: string;
  created_at: string;
  updated_at?: string;
};

type ImageGalleryProps = {
  images: ImageItem[];
  onDelete?: (imageId: string) => void;
  showDelete?: boolean;
  mentorshipId?: string;
  sessionNoteId?: string;
};

export function ImageGallery({ images, onDelete, showDelete = true, mentorshipId, sessionNoteId }: ImageGalleryProps) {
  const { data: authSession } = useSession();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Handle keyboard navigation in lightbox
  useEffect(() => {
    if (lightboxImage === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLightboxImage(null);
      } else if (e.key === "ArrowLeft" && lightboxImage !== null) {
        // Loop to the last image if at the beginning
        const newIndex = lightboxImage > 0 ? lightboxImage - 1 : images.length - 1;
        setLightboxImage(newIndex);
      } else if (e.key === "ArrowRight" && lightboxImage !== null) {
        // Loop to the first image if at the end
        const newIndex = lightboxImage < images.length - 1 ? lightboxImage + 1 : 0;
        setLightboxImage(newIndex);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage, images.length]);

  function toggleSelection(imageId: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map((img) => img.id)));
    }
  }

  async function handleDelete(imageId: string, e?: React.MouseEvent) {
    e?.stopPropagation(); // Prevent opening lightbox when clicking delete
    if (!onDelete || !confirm("Are you sure you want to delete this image?")) {
      return;
    }

    setDeleting(imageId);
    try {
      const res = await fetch(`/api/images/${imageId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onDelete(imageId);
        // Close lightbox if the deleted image was being viewed
        if (lightboxImage !== null && images[lightboxImage]?.id === imageId) {
          setLightboxImage(null);
        }
        // Remove from selection if selected
        setSelectedImages((prev) => {
          const next = new Set(prev);
          next.delete(imageId);
          return next;
        });
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.error || "Failed to delete image");
      }
    } catch (error) {
      console.error("Failed to delete image:", error);
      alert("Failed to delete image");
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeleteMultiple() {
    if (selectedImages.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedImages.size} image(s)?`)) {
      return;
    }

    setDeletingMultiple(true);
    const imageIds = Array.from(selectedImages);
    const results = await Promise.allSettled(
      imageIds.map((id) =>
        fetch(`/api/images/${id}`, {
          method: "DELETE",
        })
      )
    );

    const successful: string[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.ok) {
        successful.push(imageIds[index]);
      } else {
        failed.push(imageIds[index]);
      }
    });

    // Update parent component
    if (onDelete) {
      successful.forEach((id) => onDelete(id));
    }

    // Close lightbox if viewing a deleted image
    if (lightboxImage !== null && successful.includes(images[lightboxImage]?.id || "")) {
      setLightboxImage(null);
    }

    // Clear selection and exit selection mode
    setSelectedImages(new Set());
    setSelectionMode(false);

    if (failed.length > 0) {
      alert(`Failed to delete ${failed.length} image(s). ${successful.length} deleted successfully.`);
    } else {
      alert(`Successfully deleted ${successful.length} image(s).`);
    }

    setDeletingMultiple(false);
  }

  async function handleDownload() {
    if (!mentorshipId || downloading) return;

    setDownloading(true);
    try {
      const params = new URLSearchParams({ mentorshipId });
      if (sessionNoteId) {
        params.append("sessionNoteId", sessionNoteId);
      }

      const res = await fetch(`/api/images/download?${params.toString()}`);
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error.error || "Failed to download images");
        return;
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = sessionNoteId
        ? `session_images_${sessionNoteId}.zip`
        : `mentorship_images_${mentorshipId}.zip`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download images. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  function openLightbox(index: number) {
    setLightboxImage(index);
  }

  function closeLightbox() {
    setLightboxImage(null);
  }

  function navigateImage(direction: "prev" | "next") {
    if (lightboxImage === null) return;
    if (direction === "prev") {
      // Loop to the last image if at the beginning
      const newIndex = lightboxImage > 0 ? lightboxImage - 1 : images.length - 1;
      setLightboxImage(newIndex);
    } else if (direction === "next") {
      // Loop to the first image if at the end
      const newIndex = lightboxImage < images.length - 1 ? lightboxImage + 1 : 0;
      setLightboxImage(newIndex);
    }
  }

  // Load comments for an image
  async function loadComments(imageId: string) {
    if (comments[imageId]) return; // Already loaded
    
    try {
      const res = await fetch(`/api/images/${imageId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => ({ ...prev, [imageId]: data.comments || [] }));
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
    }
  }

  // Submit a new comment
  async function handleSubmitComment(imageId: string) {
    if (!newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/images/${imageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: newComment.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => ({
          ...prev,
          [imageId]: [...(prev[imageId] || []), data.comment],
        }));
        setNewComment("");
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.error || "Failed to post comment");
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
      alert("Failed to submit comment");
    } finally {
      setSubmittingComment(false);
    }
  }

  // Load comments when lightbox opens or image changes
  useEffect(() => {
    if (lightboxImage !== null && images[lightboxImage]) {
      loadComments(images[lightboxImage].id);
    }
  }, [lightboxImage, images]);

  if (images.length === 0) {
    return (
      <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
        <p className="text-sm text-gray-600 dark:text-neutral-400">No images uploaded yet.</p>
      </div>
    );
  }

  const currentImage = lightboxImage !== null ? images[lightboxImage] : null;
  const allSelected = images.length > 0 && selectedImages.size === images.length;
  const someSelected = selectedImages.size > 0 && selectedImages.size < images.length;

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showDelete && onDelete && (
            <>
              {!selectionMode ? (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <CheckSquare size={18} />
                  <span>Select Images</span>
                </button>
              ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedImages(new Set());
                }}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                {allSelected ? (
                  <>
                    <CheckSquare size={18} />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={18} />
                    <span>Select All</span>
                  </>
                )}
              </button>
              {selectedImages.size > 0 && (
                <button
                  onClick={handleDeleteMultiple}
                  disabled={deletingMultiple}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={18} />
                  <span>Delete {selectedImages.size} Selected</span>
                </button>
              )}
                <span className="text-sm text-gray-600 dark:text-neutral-400">
                  {selectedImages.size} of {images.length} selected
                </span>
              </div>
              )}
            </>
          )}
        </div>
        
        {/* Download button */}
        {mentorshipId && images.length > 0 && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            <span>{downloading ? "Downloading..." : "Download Images"}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((img, index) => {
          const isSelected = selectedImages.has(img.id);
          return (
            <figure
              key={img.id}
              className={`relative rounded-md overflow-hidden border-2 bg-white dark:bg-neutral-950 group transition-all ${
                selectionMode
                  ? isSelected
                    ? "border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-2"
                    : "border-gray-200 dark:border-neutral-900 cursor-pointer"
                  : "border-gray-200 dark:border-neutral-900 cursor-pointer"
              }`}
              onClick={() => {
                if (selectionMode) {
                  toggleSelection(img.id);
                } else {
                  openLightbox(index);
                }
              }}
            >
              {/* Selection checkbox */}
              {selectionMode && (
                <div className="absolute top-2 left-2 z-20">
                  <div
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500"
                        : "bg-white/90 dark:bg-neutral-900/90 border-gray-300 dark:border-neutral-700"
                    }`}
                  >
                    {isSelected && <Check size={16} className="text-white" />}
                  </div>
                </div>
              )}

              <img 
                src={img.thumbnail_url || img.image_url} 
                alt={img.caption || "image"} 
                className={`w-full h-40 object-cover transition-opacity ${
                  selectionMode && isSelected ? "opacity-75" : ""
                }`}
                loading="lazy"
              />
              {showDelete && onDelete && !selectionMode && (
                <button
                  onClick={(e) => handleDelete(img.id, e)}
                  disabled={deleting === img.id}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-red-600 dark:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                  title="Delete image"
                >
                  <Trash2 size={16} />
                </button>
              )}
              {img.caption && (
                <figcaption className="text-xs p-2 text-gray-600 dark:text-neutral-400">{img.caption}</figcaption>
              )}
            </figure>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage !== null && currentImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 dark:bg-black/95 p-4"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-md bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 text-white transition-colors z-10"
            title="Close (ESC)"
          >
            <X size={24} />
          </button>

          {/* Comments toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(!showComments);
              if (!showComments) {
                loadComments(currentImage.id);
              }
            }}
            className="absolute top-4 right-16 p-2 rounded-md bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 text-white transition-colors z-10"
            title="Toggle Comments"
          >
            <MessageSquare size={24} />
          </button>

          {/* Navigation buttons - always show since we loop */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateImage("prev");
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-md bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 text-white transition-colors z-10"
            title="Previous (←)"
          >
            <ChevronLeft size={32} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateImage("next");
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-md bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 text-white transition-colors z-10"
            title="Next (→)"
          >
            <ChevronRight size={32} />
          </button>

          {/* Image container */}
          <div
            className={`relative max-w-7xl max-h-full flex flex-col items-center transition-all ${
              showComments ? "mr-96" : ""
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentImage.image_url}
              alt={currentImage.caption || "image"}
              className="max-w-full max-h-[90vh] object-contain"
            />
            {currentImage.caption && (
              <p className="mt-4 text-white text-center max-w-2xl px-4">{currentImage.caption}</p>
            )}
            {/* Image counter */}
            <p className="mt-2 text-white/70 text-sm">
              {lightboxImage + 1} / {images.length}
            </p>
          </div>

          {/* Comments Panel */}
          {showComments && (
            <div
              className="absolute right-0 top-0 bottom-0 w-96 bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 flex flex-col z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
                <h3 className="font-semibold text-gray-900 dark:text-white">Comments</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {comments[currentImage.id]?.length > 0 ? (
                  comments[currentImage.id].map((comment) => (
                    <div key={comment.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">
                          {comment.user_type === "instructor" ? "👨‍🏫 Instructor" : comment.user_type === "admin" ? "👑 Admin" : "👤 Student"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-neutral-500">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 dark:text-white">{comment.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-neutral-500 text-center py-8">
                    No comments yet. Be the first to comment!
                  </p>
                )}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment(currentImage.id);
                      }
                    }}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    disabled={submittingComment}
                  />
                  <button
                    onClick={() => handleSubmitComment(currentImage.id)}
                    disabled={!newComment.trim() || submittingComment}
                    className="p-2 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send comment"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

