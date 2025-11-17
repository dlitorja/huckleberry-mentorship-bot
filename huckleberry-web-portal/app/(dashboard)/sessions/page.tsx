"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ImageUploader } from "@/components/ImageUploader";
import { ImageGallery } from "@/components/ImageGallery";
import { Plus, FileText } from "lucide-react";

type Session = { id: string; mentorship_id: string; notes: string | null; session_date: string | null; created_at: string };
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mentorship, setMentorship] = useState<MentorshipData | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const userRole = (authSession as any)?.role || "unknown";
  const isAdmin = userRole === "admin";
  
  // Count general images (not tied to a specific session)
  const generalImageCount = images.filter(img => !img.session_note_id).length;

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
    if (!noteContent.trim() || !mentorship?.id || isSubmitting) return;

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

      {/* Create Note Form */}
      {showNoteForm && mentorship && (
        <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-gray-600 dark:text-neutral-400" />
            <h2 className="font-medium text-gray-900 dark:text-white">Create Session Note</h2>
          </div>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Write your session notes here..."
            className="w-full min-h-[120px] px-3 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            disabled={isSubmitting}
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleCreateNote}
              disabled={!noteContent.trim() || isSubmitting}
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
      {images.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Uploaded Images</h2>
          <ImageGallery 
            images={images} 
            onDelete={handleImageDelete} 
            showDelete={true}
            mentorshipId={mentorship?.id}
          />
        </div>
      )}

      {/* Sessions List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Session Notes</h2>
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 hover:shadow-sm transition-shadow">
              <Link href={`/sessions/${s.id}`} className="font-medium text-gray-900 dark:text-white hover:underline">
                {new Date(s.created_at).toLocaleString()}
              </Link>
              <p className="text-sm text-gray-600 dark:text-neutral-400 line-clamp-2 mt-1">{s.notes || "No notes yet."}</p>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
              <div className="font-medium text-gray-900 dark:text-white">No sessions found</div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                {mentorship 
                  ? "Create your first session note using the 'Add Note' button above, or wait for your instructor to add notes."
                  : "Once your instructor adds notes via Discord or the portal, they will appear here."}
              </p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

