import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { auth } from "@/auth";

// GET /api/images?mentorshipId=xxx - Get all images for a mentorship
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = String((session as any).role || "unknown");
  const discordId = String((session.user as any)?.id || "");
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
    .select("id, image_url, thumbnail_url, uploader_type, created_at, session_note_id, caption, tags")
    .eq("mentorship_id", mentorshipId)
    .order("created_at", { ascending: false });

  if (sessionNoteId) {
    query = query.eq("session_note_id", sessionNoteId);
  } else {
    // If no sessionNoteId, get both general images (null session_note_id) and all session images
    // We'll filter general images on the client side or return all
  }

  const { data: images, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ images: images || [] });
}

