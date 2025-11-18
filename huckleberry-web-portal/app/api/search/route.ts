import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !(session.user as any)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const discordId = String((session.user as any).id);
    const role = String((session as any).role || "unknown");
    const supabase = getSupabaseClient(true);

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || [];

    if (!query && !dateFrom && !dateTo && tags.length === 0) {
      return NextResponse.json({ error: "At least one search parameter is required" }, { status: 400 });
    }

    // Get mentorship IDs based on role
    let mentorshipIds: string[] = [];

    if (role === "student") {
      const { data: menteeData } = await supabase
        .from("mentees")
        .select("id")
        .eq("discord_id", discordId)
        .maybeSingle();

      if (!menteeData) {
        return NextResponse.json({ error: "Mentee not found" }, { status: 404 });
      }

      const { data: mentorships } = await supabase
        .from("mentorships")
        .select("id")
        .eq("mentee_id", menteeData.id)
        .eq("status", "active");

      mentorshipIds = mentorships?.map((m: { id: string }) => m.id) || [];
    } else if (role === "instructor") {
      const { data: instructorData } = await supabase
        .from("instructors")
        .select("id")
        .eq("discord_id", discordId)
        .maybeSingle();

      if (!instructorData) {
        return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
      }

      const { data: mentorships } = await supabase
        .from("mentorships")
        .select("id")
        .eq("instructor_id", instructorData.id)
        .eq("status", "active");

      mentorshipIds = mentorships?.map((m: { id: string }) => m.id) || [];
    } else if (role === "admin") {
      const { data: mentorships } = await supabase
        .from("mentorships")
        .select("id")
        .eq("status", "active");

      mentorshipIds = mentorships?.map((m: { id: string }) => m.id) || [];
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (mentorshipIds.length === 0) {
      return NextResponse.json({ sessions: [], images: [] });
    }

    // Search session notes
    let notesQuery = supabase
      .from("session_notes")
      .select("id, mentorship_id, notes, session_date, created_at")
      .in("mentorship_id", mentorshipIds);

    // Apply text search on notes
    if (query) {
      // Use ilike for case-insensitive search (PostgreSQL)
      notesQuery = notesQuery.ilike("notes", `%${query}%`);
    }

    // Apply date filters
    if (dateFrom) {
      notesQuery = notesQuery.gte("session_date", dateFrom);
    }
    if (dateTo) {
      notesQuery = notesQuery.lte("session_date", dateTo);
    }

    // Apply date range to created_at if session_date is not available
    if ((dateFrom || dateTo) && !query) {
      if (dateFrom) {
        notesQuery = notesQuery.gte("created_at", dateFrom);
      }
      if (dateTo) {
        notesQuery = notesQuery.lte("created_at", dateTo);
      }
    }

    notesQuery = notesQuery.order("created_at", { ascending: false }).limit(100);

    const { data: sessions, error: sessionsError } = await notesQuery;

    if (sessionsError) {
      console.error("[Search API] Error fetching sessions:", sessionsError);
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    // Search session images (captions)
    let imagesQuery = supabase
      .from("session_images")
      .select("id, image_url, thumbnail_url, caption, session_note_id, mentorship_id, created_at, uploader_type")
      .in("mentorship_id", mentorshipIds);

    // Apply text search on captions
    if (query) {
      imagesQuery = imagesQuery.ilike("caption", `%${query}%`);
    }

    // Apply date filters on images
    if (dateFrom || dateTo) {
      if (dateFrom) {
        imagesQuery = imagesQuery.gte("created_at", dateFrom);
      }
      if (dateTo) {
        imagesQuery = imagesQuery.lte("created_at", dateTo);
      }
    }

    // Apply tags filter
    if (tags.length > 0) {
      // Use PostgreSQL array overlap operator (&&) to check if any tag matches
      imagesQuery = imagesQuery.contains("tags", tags);
    }

    imagesQuery = imagesQuery.order("created_at", { ascending: false }).limit(100);

    const { data: images, error: imagesError } = await imagesQuery;

    if (imagesError) {
      console.error("[Search API] Error fetching images:", imagesError);
      return NextResponse.json({ error: imagesError.message }, { status: 500 });
    }

    return NextResponse.json({
      sessions: sessions || [],
      images: images || [],
      query,
      dateFrom,
      dateTo,
      tags,
    });
  } catch (error) {
    console.error("[Search API] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

