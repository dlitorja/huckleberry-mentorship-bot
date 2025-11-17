import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const role = String(token?.role || "unknown");
  const discordId = String(token?.discordId || "");
  
  if (role !== "student") {
    return NextResponse.json({ error: "This endpoint is for students only" }, { status: 403 });
  }
  
  const supabase = getSupabaseClient(true);
  
  // First, get the mentee ID from discord_id
  const { data: menteeData, error: menteeError } = await supabase
    .from("mentees")
    .select("id")
    .eq("discord_id", discordId)
    .maybeSingle();
  
  if (menteeError || !menteeData) {
    return NextResponse.json({ 
      mentorship: null,
      message: "Mentee not found"
    });
  }
  
  // Get the mentee's active mentorship with instructor info
  const { data: mentorship, error } = await supabase
    .from("mentorships")
    .select(`
      id,
      sessions_remaining,
      total_sessions,
      instructors(id, name, discord_id),
      mentees(id, display_name, discord_username, email, discord_id)
    `)
    .eq("mentee_id", menteeData.id)
    .eq("status", "active")
    .maybeSingle();
  
  if (error) {
    console.error('[Mentee Dashboard API] Error fetching mentorship:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  if (!mentorship) {
    console.log('[Mentee Dashboard API] No mentorship found for mentee:', menteeData.id, 'discordId:', discordId);
    return NextResponse.json({ 
      mentorship: null,
      message: "No active mentorship found"
    });
  }
  
  console.log('[Mentee Dashboard API] Found mentorship:', mentorship.id);
  // Handle both array and single object responses from Supabase
  const instructor = Array.isArray(mentorship.instructors) ? mentorship.instructors[0] : mentorship.instructors;
  const mentee = Array.isArray(mentorship.mentees) ? mentorship.mentees[0] : mentorship.mentees;
  
  return NextResponse.json({ 
    mentorship: {
      id: mentorship.id,
      sessions_remaining: mentorship.sessions_remaining,
      total_sessions: mentorship.total_sessions,
      instructor: instructor,
      mentee: mentee,
    }
  });
}

