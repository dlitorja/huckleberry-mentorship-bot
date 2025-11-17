import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !(token as any).discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const discordId = String((token as any).discordId);
    const role = String((token as any).role || "unknown");
    
    console.log("[Sessions API] Request from role:", role, "discordId:", discordId);
    
    const supabase = getSupabaseClient(true);
    if (!supabase) {
      console.error("[Sessions API] Failed to get Supabase client");
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    let mentorshipIds: string[] = [];

    if (role === "student") {
      // Get mentee ID from discord_id
      const { data: menteeData, error: menteeError } = await supabase
        .from("mentees")
        .select("id")
        .eq("discord_id", discordId)
        .maybeSingle();
      
      if (menteeError) {
        console.error("[Sessions API] Error fetching mentee:", menteeError);
        return NextResponse.json({ error: menteeError.message }, { status: 500 });
      }
      
      if (!menteeData) {
        return NextResponse.json({ error: "Mentee not found" }, { status: 404 });
      }

      // Get mentorship IDs for this mentee
      const { data: mentorships, error: mentorshipsError } = await supabase
        .from("mentorships")
        .select("id")
        .eq("mentee_id", menteeData.id)
        .eq("status", "active");
      
      if (mentorshipsError) {
        console.error("[Sessions API] Error fetching mentorships for student:", mentorshipsError);
        return NextResponse.json({ error: mentorshipsError.message }, { status: 500 });
      }
      
      mentorshipIds = mentorships?.map((m) => m.id) || [];
    } else if (role === "instructor") {
      // Get instructor ID from discord_id
      const { data: instructorData, error: instructorError } = await supabase
        .from("instructors")
        .select("id")
        .eq("discord_id", discordId)
        .maybeSingle();
      
      if (instructorError) {
        console.error("[Sessions API] Error fetching instructor:", instructorError);
        return NextResponse.json({ error: instructorError.message }, { status: 500 });
      }
      
      if (!instructorData) {
        return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
      }

      // Get mentorship IDs for this instructor
      const { data: mentorships, error: mentorshipsError } = await supabase
        .from("mentorships")
        .select("id")
        .eq("instructor_id", instructorData.id)
        .eq("status", "active");
      
      if (mentorshipsError) {
        console.error("[Sessions API] Error fetching mentorships for instructor:", mentorshipsError);
        return NextResponse.json({ error: mentorshipsError.message }, { status: 500 });
      }
      
      mentorshipIds = mentorships?.map((m) => m.id) || [];
    } else if (role === "admin") {
      // Admins can see all active mentorships
      const { data: mentorships, error: mentorshipsError } = await supabase
        .from("mentorships")
        .select("id")
        .eq("status", "active");
      
      if (mentorshipsError) {
        console.error("[Sessions API] Error fetching mentorships for admin:", mentorshipsError);
        return NextResponse.json({ error: mentorshipsError.message }, { status: 500 });
      }
      
      mentorshipIds = mentorships?.map((m) => m.id) || [];
    } else {
      console.error("[Sessions API] Invalid role:", role);
      return NextResponse.json({ error: `Forbidden: Invalid role '${role}'` }, { status: 403 });
    }

    console.log("[Sessions API] Found", mentorshipIds.length, "mentorship IDs");

    // Get session notes for the mentorship IDs
    let query = supabase
      .from("session_notes")
      .select("id, mentorship_id, notes, session_date, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (mentorshipIds.length > 0) {
      query = query.in("mentorship_id", mentorshipIds);
    } else {
      // If no mentorships found, return empty array
      console.log("[Sessions API] No mentorships found, returning empty array");
      return NextResponse.json({ sessions: [] });
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Sessions API] Error fetching session notes:", error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }
    
    console.log("[Sessions API] Successfully fetched", data?.length || 0, "session notes");
    return NextResponse.json({ sessions: data || [] });
  } catch (error) {
    console.error("[Sessions API] Unexpected error:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !(token as any).discordId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const discordId = String((token as any).discordId);
  const role = String((token as any).role || "unknown");
  const supabase = getSupabaseClient(true);

  const body = await req.json().catch(() => ({}));
  const { content, mentorship_id } = body;

  if (!content || !mentorship_id) {
    return NextResponse.json({ error: "Missing content or mentorship_id" }, { status: 400 });
  }

  // Use 'notes' column to match database schema
  const notes = content;

  // Verify the user has access to this mentorship
  if (role === "student") {
    // Get mentee ID from discord_id
    const { data: menteeData } = await supabase
      .from("mentees")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();
    
    if (!menteeData) {
      return NextResponse.json({ error: "Mentee not found" }, { status: 404 });
    }

    // Verify mentorship belongs to this mentee
    const { data: mentorship } = await supabase
      .from("mentorships")
      .select("id")
      .eq("id", mentorship_id)
      .eq("mentee_id", menteeData.id)
      .eq("status", "active")
      .maybeSingle();

    if (!mentorship) {
      return NextResponse.json({ error: "Mentorship not found or access denied" }, { status: 403 });
    }
  } else if (role === "instructor") {
    // Get instructor ID from discord_id
    const { data: instructorData } = await supabase
      .from("instructors")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();
    
    if (!instructorData) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    // Verify mentorship belongs to this instructor
    const { data: mentorship } = await supabase
      .from("mentorships")
      .select("id")
      .eq("id", mentorship_id)
      .eq("instructor_id", instructorData.id)
      .eq("status", "active")
      .maybeSingle();

    if (!mentorship) {
      return NextResponse.json({ error: "Mentorship not found or access denied" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create the session note
  const { data: sessionNote, error: insertError } = await supabase
    .from("session_notes")
    .insert({
      mentorship_id,
      notes: notes.trim(),
      session_date: new Date().toISOString().split('T')[0], // Today's date
      created_by_discord_id: discordId
    })
    .select("id, mentorship_id, notes, session_date, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ session: sessionNote });
}

