"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Upload, Copy, Check, X, Loader2, Image as ImageIcon } from "lucide-react";

interface UploadedAsset {
  id: string;
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export default function AssetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login?callbackUrl=/assets");
      return;
    }
    const role = session?.role;
    if (role !== "admin") {
      router.push("/dashboard");
      return;
    }
    loadAssets();
  }, [session, status, router]);

  async function loadAssets() {
    try {
      const res = await fetch("/api/assets");
      if (res.ok) {
        const data = await res.json();
        setUploadedAssets(data.assets || []);
      }
    } catch (error) {
      console.error("Failed to load assets:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(
        (file) => file.type.startsWith("image/")
      );
      setFiles((prev) => [...prev, ...newFiles]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(
        (file) => file.type.startsWith("image/")
      );
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleUpload() {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const form = new FormData();
      files.forEach((file) => {
        form.append("files", file);
      });

      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: form,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadedAssets((prev) => [...data.assets, ...prev]);
        setFiles([]);
        alert(`Successfully uploaded ${data.assets.length} image(s)`);
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

  async function copyUrl(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }

  async function deleteAsset(id: string, _url: string) {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setUploadedAssets((prev) => prev.filter((asset) => asset.id !== id));
      } else {
        alert("Failed to delete image");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete image");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Image Assets Hosting
          </h1>
          <p className="text-gray-600 dark:text-neutral-400">
            Upload high-quality images for your Kajabi landing pages. Drag and drop or click to select.
          </p>
        </div>

        {/* Upload Area */}
        <div className="mb-8">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20"
                : "border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleFileInput}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="w-12 h-12 text-gray-400 dark:text-neutral-500 mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-neutral-300 mb-2">
                Drag and drop images here, or click to select
              </p>
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                Supports PNG, JPG, WebP, and other image formats
              </p>
            </label>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                Selected Files ({files.length}):
              </p>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="mt-4 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Upload {files.length} image{files.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Uploaded Assets Grid */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Uploaded Images ({uploadedAssets.length})
          </h2>
          {uploadedAssets.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
              <ImageIcon className="w-12 h-12 text-gray-400 dark:text-neutral-500 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-neutral-400">
                No images uploaded yet. Upload your first image above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploadedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden"
                >
                  <div className="aspect-video bg-gray-100 dark:bg-neutral-800 relative">
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2 truncate">
                      {asset.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
                      {formatFileSize(asset.size)} • {new Date(asset.uploadedAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={asset.url}
                        readOnly
                        className="flex-1 text-xs px-2 py-1 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded text-gray-700 dark:text-neutral-300"
                      />
                      <button
                        onClick={() => copyUrl(asset.url, asset.id)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        title="Copy URL"
                      >
                        {copiedId === asset.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteAsset(asset.id, asset.url)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                        title="Delete"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

