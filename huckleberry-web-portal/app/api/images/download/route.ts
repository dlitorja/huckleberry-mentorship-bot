import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";
import JSZip from "jszip";

// GET /api/images/download?mentorshipId=xxx&sessionNoteId=xxx - Download images as ZIP
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = String((token as any).role || "unknown");
  const discordId = String((token as any).discordId || "");
  const supabase = getSupabaseClient(true);

  const { searchParams } = new URL(req.url);
  const mentorshipId = searchParams.get("mentorshipId");
  const sessionNoteId = searchParams.get("sessionNoteId"); // Optional: filter by session

  if (!mentorshipId) {
    return NextResponse.json({ error: "Missing mentorshipId" }, { status: 400 });
  }

  // Verify user has access to this mentorship
  if (role === "student") {
    const { data: menteeData } = await supabase
      .from("mentees")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();
    
    if (!menteeData) {
      return NextResponse.json({ error: "Mentee not found" }, { status: 404 });
    }

    const { data: mentorship } = await supabase
      .from("mentorships")
      .select("id")
      .eq("id", mentorshipId)
      .eq("mentee_id", menteeData.id)
      .eq("status", "active")
      .maybeSingle();

    if (!mentorship) {
      return NextResponse.json({ error: "Mentorship not found or access denied" }, { status: 403 });
    }
  } else if (role === "instructor") {
    const { data: instructorData } = await supabase
      .from("instructors")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();
    
    if (!instructorData) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    const { data: mentorship } = await supabase
      .from("mentorships")
      .select("id")
      .eq("id", mentorshipId)
      .eq("instructor_id", instructorData.id)
      .eq("status", "active")
      .maybeSingle();

    if (!mentorship) {
      return NextResponse.json({ error: "Mentorship not found or access denied" }, { status: 403 });
    }
  } else if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch images
  let query = supabase
    .from("session_images")
    .select("id, image_url, thumbnail_url, caption, created_at, session_note_id")
    .eq("mentorship_id", mentorshipId)
    .order("created_at", { ascending: true });

  if (sessionNoteId) {
    query = query.eq("session_note_id", sessionNoteId);
  }

  const { data: images, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!images || images.length === 0) {
    return NextResponse.json({ error: "No images found" }, { status: 404 });
  }

  // Create ZIP file
  const zip = new JSZip();

  // Group images by session if downloading all images
  if (!sessionNoteId) {
    // Get session notes for grouping
    const { data: sessions } = await supabase
      .from("session_notes")
      .select("id, created_at, notes")
      .eq("mentorship_id", mentorshipId)
      .order("created_at", { ascending: true });

    const sessionMap = new Map<string, any>();
    if (sessions) {
      sessions.forEach((s) => sessionMap.set(s.id, s));
    }

    // Group images by session
    const imagesBySession = new Map<string, typeof images>();
    images.forEach((img) => {
      const sessionId = img.session_note_id || "general";
      if (!imagesBySession.has(sessionId)) {
        imagesBySession.set(sessionId, []);
      }
      imagesBySession.get(sessionId)!.push(img);
    });

    // Add images to ZIP organized by session
    for (const [sessionId, sessionImages] of imagesBySession.entries()) {
      const session = sessionMap.get(sessionId);
      const sessionName = session
        ? `Session_${new Date(session.created_at).toISOString().split("T")[0]}`
        : "General_Images";
      
      const sessionFolder = zip.folder(sessionName);
      if (!sessionFolder) continue;

      // Add session notes if available
      if (session?.notes) {
        sessionFolder.file("notes.txt", session.notes);
      }

      // Download and add images
      for (let i = 0; i < sessionImages.length; i++) {
        const img = sessionImages[i];
        try {
          const imageResponse = await fetch(img.image_url);
          if (imageResponse.ok) {
            const imageArrayBuffer = await imageResponse.arrayBuffer();
            const extension = img.image_url.split(".").pop()?.split("?")[0] || "webp";
            const filename = `image_${String(i + 1).padStart(3, "0")}.${extension}`;
            sessionFolder.file(filename, Buffer.from(imageArrayBuffer));
            
            // Add caption if available
            if (img.caption) {
              sessionFolder.file(`image_${String(i + 1).padStart(3, "0")}_caption.txt`, img.caption);
            }
          } else {
            console.error(`Failed to fetch image ${img.id}: ${imageResponse.status} ${imageResponse.statusText}`);
          }
        } catch (error) {
          console.error(`Failed to download image ${img.id}:`, error);
        }
      }
    }
  } else {
    // Single session download - flat structure
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const imageResponse = await fetch(img.image_url);
        if (imageResponse.ok) {
          const imageArrayBuffer = await imageResponse.arrayBuffer();
          const extension = img.image_url.split(".").pop()?.split("?")[0] || "webp";
          const filename = `image_${String(i + 1).padStart(3, "0")}.${extension}`;
          zip.file(filename, Buffer.from(imageArrayBuffer));
          
          // Add caption if available
          if (img.caption) {
            zip.file(`image_${String(i + 1).padStart(3, "0")}_caption.txt`, img.caption);
          }
        } else {
          console.error(`Failed to fetch image ${img.id}: ${imageResponse.status} ${imageResponse.statusText}`);
        }
      } catch (error) {
        console.error(`Failed to download image ${img.id}:`, error);
      }
    }
  }

  try {
    // Generate ZIP file (use nodebuffer for server-side)
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Return ZIP file
    const filename = sessionNoteId
      ? `session_images_${sessionNoteId}.zip`
      : `mentorship_images_${mentorshipId}.zip`;

    // Convert Buffer to Uint8Array for NextResponse compatibility
    // NextResponse accepts Uint8Array as BodyInit
    const uint8Array = new Uint8Array(zipBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate ZIP file:", error);
    return NextResponse.json({ 
      error: "Failed to generate ZIP file", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

