"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ImageUploader } from "@/components/ImageUploader";
import { ImageGallery } from "@/components/ImageGallery";

type Props = { params: Promise<{ id: string }> };

type ImageItem = {
  id: string;
  image_url: string;
  caption?: string | null;
  uploader_type?: string;
  created_at?: string;
};

export default function SessionDetailPage(props: Props) {
  const { data: authSession } = useSession();
  const [sessionId, setSessionId] = useState<string>("");
  const [session, setSession] = useState<any>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const userRole = (authSession as any)?.role || "unknown";
  const isAdmin = userRole === "admin";

  useEffect(() => {
    async function loadData() {
      props.params.then(async ({ id }) => {
        setSessionId(id);
        try {
          const res = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
          const data = await res.json().catch(() => ({}));
          setSession(data.session);
          setImages((data.images || []) as ImageItem[]);
        } catch (error) {
          console.error("Failed to load session:", error);
        } finally {
          setLoading(false);
        }
      });
    }
    loadData();
  }, [props.params]);

  function handleImageDelete(imageId: string) {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    // Image count will be refreshed by ImageUploader component automatically
  }

  function handleImageUpload() {
    // Reload images after upload
    if (sessionId) {
      fetch(`/api/sessions/${sessionId}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => setImages((data.images || []) as ImageItem[]))
        .catch((error) => console.error("Failed to reload images:", error));
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Session Detail</h1>
        <p className="text-sm text-gray-600 dark:text-neutral-400 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Session Detail</h1>
        <p className="text-sm text-gray-600 dark:text-neutral-400 mt-2">
          {session?.created_at ? new Date(session.created_at).toLocaleString() : "Session"}
        </p>
      </div>
      {session?.notes && (
        <div className="p-4 rounded-md border border-gray-200 dark:border-neutral-900 bg-white dark:bg-neutral-950">
          <div 
            className="prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-white"
            dangerouslySetInnerHTML={{ __html: session.notes }}
          />
        </div>
      )}
      {session?.mentorship_id && (
        <div>
          <ImageUploader 
            mentorshipId={session.mentorship_id} 
            sessionNoteId={sessionId} 
            onUpload={handleImageUpload}
            imageLimit={75}
            isAdmin={isAdmin}
          />
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Session Images</h2>
        <ImageGallery 
          images={images} 
          onDelete={handleImageDelete} 
          showDelete={true}
          mentorshipId={session?.mentorship_id}
          sessionNoteId={sessionId}
        />
      </div>
    </div>
  );
}

