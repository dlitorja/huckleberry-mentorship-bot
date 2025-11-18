"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import Link from "next/link";
import { ImageUploader } from "@/components/ImageUploader";
import { ImageGallery } from "@/components/ImageGallery";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Plus, FileText, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SessionNote = { id: string; mentorship_id: string; notes: string | null; session_date: string | null; created_at: string };
type MentorshipData = {
  id: string;
  sessions_remaining: number | null;
  total_sessions: number | null;
  instructor: {
    id: string;
    name: string | null;
    discord_id: string | null;
  } | null;
};

type ImageItem = {
  id: string;
  image_url: string;
  caption?: string | null;
  uploader_type?: string;
  created_at?: string;
  session_note_id?: string | null;
};

export default function SessionsListPage() {
  const { data: authSession } = useSession();
  const [sessions, setSessions] = useState<SessionNote[]>([]);
  const [mentorship, setMentorship] = useState<MentorshipData | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const userRole = (authSession as Session & { role?: string } | null)?.role || "unknown";
  const isAdmin = userRole === "admin";
  
  // Count general images (not tied to a specific session) - kept for future use
  const _generalImageCount = images.filter(img => !img.session_note_id).length;

  // Filter sessions based on search query and date range
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Text search in notes
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        const notesText = s.notes?.replace(/<[^>]*>/g, '').toLowerCase() || '';
        return notesText.includes(query);
      });
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter((s) => {
        const sessionDate = s.session_date ? new Date(s.session_date) : new Date(s.created_at);
        if (dateFrom && sessionDate < new Date(dateFrom)) return false;
        if (dateTo && sessionDate > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      });
    }

    return filtered;
  }, [sessions, searchQuery, dateFrom, dateTo]);

  // Filter images based on search query and date range
  const filteredImages = useMemo(() => {
    let filtered = images;

    // Text search in captions
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((img) => {
        const captionText = img.caption?.toLowerCase() || '';
        return captionText.includes(query);
      });
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter((img) => {
        if (!img.created_at) return false;
        const imageDate = new Date(img.created_at);
        if (dateFrom && imageDate < new Date(dateFrom)) return false;
        if (dateTo && imageDate > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      });
    }

    return filtered;
  }, [images, searchQuery, dateFrom, dateTo]);

  const hasActiveFilters = searchQuery.trim() !== '' || dateFrom !== '' || dateTo !== '';

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  useEffect(() => {
    async function loadData() {
      try {
        // Load sessions
        const sessionsRes = await fetch("/api/sessions", { cache: "no-store" });
        const sessionsData = await sessionsRes.json().catch(() => ({ sessions: [] }));
        setSessions(sessionsData.sessions || []);

        // Load mentorship for mentees (to get mentorship_id)
        const mentorshipRes = await fetch("/api/mentee/dashboard", { cache: "no-store" });
        if (mentorshipRes.ok) {
          const mentorshipData = await mentorshipRes.json();
          setMentorship(mentorshipData.mentorship || null);
          
          // Load images for this mentorship
          if (mentorshipData.mentorship?.id) {
            const imagesRes = await fetch(`/api/images?mentorshipId=${mentorshipData.mentorship.id}`, { cache: "no-store" });
            if (imagesRes.ok) {
              const imagesData = await imagesRes.json();
              setImages(imagesData.images || []);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function handleImageDelete(imageId: string) {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    // Image count will update automatically since it's based on generalImageCount
  }

  function handleImageUpload() {
    // Reload images after upload
    if (mentorship?.id) {
      fetch(`/api/images?mentorshipId=${mentorship.id}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => setImages(data.images || []))
        .catch((error) => console.error("Failed to reload images:", error));
    }
  }

  async function handleCreateNote() {
    // Check if content has actual text (strip HTML tags)
    const textContent = noteContent.replace(/<[^>]*>/g, '').trim();
    if (!textContent || !mentorship?.id || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: noteContent.trim(),
          mentorship_id: mentorship.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => [data.session, ...prev]);
        setNoteContent("");
        setShowNoteForm(false);
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.error || "Failed to create note");
      }
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Failed to create note");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Your Sessions</h1>
        <p className="text-sm text-gray-600 dark:text-neutral-400 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Your Sessions</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-md border transition-colors",
              showFilters || hasActiveFilters
                ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                : "border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
            )}
          >
            <Filter size={18} />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-indigo-600 dark:bg-indigo-500 text-white rounded-full">
                {(searchQuery.trim() !== '' ? 1 : 0) + (dateFrom !== '' ? 1 : 0) + (dateTo !== '' ? 1 : 0)}
              </span>
            )}
          </button>
          {mentorship && (
            <button
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
            >
              <Plus size={18} />
              <span>Add Note</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-900 dark:text-white">Filter Sessions & Images</h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
              >
                <X size={16} />
                Clear filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Query */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                Search Notes & Captions
              </label>
              <input
                type="text"
                placeholder="Search text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              />
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 text-sm text-gray-600 dark:text-neutral-400">
              Showing {filteredSessions.length} of {sessions.length} sessions
              {filteredImages.length !== images.length && (
                <span>, {filteredImages.length} of {images.length} images</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Note Form */}
      {showNoteForm && mentorship && (
        <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-gray-600 dark:text-neutral-400" />
            <h2 className="font-medium text-gray-900 dark:text-white">Create Session Note</h2>
          </div>
          <RichTextEditor
            content={noteContent}
            onChange={setNoteContent}
            placeholder="Write your session notes here..."
            disabled={isSubmitting}
            minHeight="200px"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleCreateNote}
              disabled={!noteContent.replace(/<[^>]*>/g, '').trim() || isSubmitting}
              className="px-4 py-2 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Note"}
            </button>
            <button
              onClick={() => {
                setShowNoteForm(false);
                setNoteContent("");
              }}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Image Uploader for General Images (not tied to a specific session) */}
      {mentorship && (
        <div>
          <ImageUploader 
            mentorshipId={mentorship.id} 
            onUpload={handleImageUpload}
            imageLimit={75}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* Display Uploaded Images */}
      {filteredImages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Uploaded Images
            {hasActiveFilters && filteredImages.length !== images.length && (
              <span className="text-sm font-normal text-gray-600 dark:text-neutral-400 ml-2">
                ({filteredImages.length} of {images.length})
              </span>
            )}
          </h2>
          <ImageGallery 
            images={filteredImages} 
            onDelete={handleImageDelete} 
            showDelete={true}
            mentorshipId={mentorship?.id}
          />
        </div>
      )}
      {images.length > 0 && filteredImages.length === 0 && hasActiveFilters && (
        <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
          <p className="text-sm text-gray-600 dark:text-neutral-400">
            No images match your filters.
          </p>
        </div>
      )}

      {/* Sessions List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Session Notes
          {hasActiveFilters && filteredSessions.length !== sessions.length && (
            <span className="text-sm font-normal text-gray-600 dark:text-neutral-400 ml-2">
              ({filteredSessions.length} of {sessions.length})
            </span>
          )}
        </h2>
        <ul className="space-y-3">
          {filteredSessions.map((s) => (
            <li key={s.id} className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 hover:shadow-sm transition-shadow">
              <Link href={`/sessions/${s.id}`} className="font-medium text-gray-900 dark:text-white hover:underline">
                {new Date(s.created_at).toLocaleString()}
              </Link>
              <p className="text-sm text-gray-600 dark:text-neutral-400 line-clamp-2 mt-1">
                {s.notes 
                  ? s.notes.replace(/<[^>]*>/g, '').substring(0, 150) + (s.notes.length > 150 ? '...' : '')
                  : "No notes yet."}
              </p>
            </li>
          ))}
          {filteredSessions.length === 0 && sessions.length === 0 && (
            <li className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
              <div className="font-medium text-gray-900 dark:text-white">No sessions found</div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                {mentorship 
                  ? "Create your first session note using the 'Add Note' button above, or wait for your instructor to add notes."
                  : "Once your instructor adds notes via Discord or the portal, they will appear here."}
              </p>
            </li>
          )}
          {filteredSessions.length === 0 && sessions.length > 0 && hasActiveFilters && (
            <li className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
              <div className="font-medium text-gray-900 dark:text-white">No sessions match your filters</div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                Try adjusting your search query or date range.
              </p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

