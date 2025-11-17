import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = String((token as any).role || "unknown");
  const discordId = String((token as any).discordId || "");
  
  console.log("API /instructor/mentorships - Role:", role, "DiscordId:", discordId);
  
  if (role !== "instructor" && role !== "admin") {
    return NextResponse.json({ error: `Forbidden: role is '${role}', expected 'instructor' or 'admin'` }, { status: 403 });
  }
  const supabase = getSupabaseClient(true);
  
  // For admins: return all instructors with their mentees grouped
  if (role === "admin") {
    const { data: instructors, error: instructorsError } = await supabase
      .from("instructors")
      .select("id, name, discord_id");
    
    if (instructorsError) {
      console.error("Error fetching instructors:", instructorsError);
      return NextResponse.json({ error: `Failed to fetch instructors: ${instructorsError.message}` }, { status: 500 });
    }
    
    // Get all active mentorships with mentee info
    const { data: mentorships, error: mentorshipsError } = await supabase
      .from("mentorships")
      .select(`
        id,
        sessions_remaining,
        instructor_id,
        mentees(id, discord_id, email, discord_username, display_name)
      `)
      .eq("status", "active");
    
    if (mentorshipsError) {
      console.error("Error fetching mentorships:", mentorshipsError);
      return NextResponse.json({ error: `Failed to fetch mentorships: ${mentorshipsError.message}` }, { status: 500 });
    }
    
    // Group mentorships by instructor
    const instructorsWithMentees = instructors?.map((instructor) => ({
      instructor: {
        id: instructor.id,
        name: instructor.name,
        discord_id: instructor.discord_id,
        discord_username: null, // Instructors table doesn't have discord_username
      },
      mentorships: mentorships?.filter((m) => m.instructor_id === instructor.id) || [],
    })) || [];
    
    return NextResponse.json({ instructors: instructorsWithMentees, isAdmin: true });
  }
  
  // For instructors: return only their own mentorships
  // First get instructor ID from discord_id
  const { data: instructorData, error: instructorErr } = await supabase
    .from("instructors")
    .select("id")
    .eq("discord_id", discordId)
    .maybeSingle();
  
  if (instructorErr || !instructorData) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }
  
  const { data, error } = await supabase
    .from("mentorships")
    .select("id, sessions_remaining, mentees(id, discord_id, email, discord_username, display_name)")
    .eq("status", "active")
    .eq("instructor_id", instructorData.id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ mentorships: data, isAdmin: false });
}

