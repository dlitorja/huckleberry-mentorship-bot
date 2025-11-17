import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";
import { z } from "zod";

const UpdateDisplayNameSchema = z.object({
  menteeId: z.string().uuid(),
  displayName: z.string().max(100).optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const role = String((token as any).role || "unknown");
  const discordId = String((token as any).discordId || "");
  
  if (role !== "instructor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const supabase = getSupabaseClient(true);
  const body = await req.json().catch(() => ({}));
  
  const parsed = UpdateDisplayNameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error }, { status: 400 });
  }
  
  const { menteeId, displayName } = parsed.data;
  
  // Verify the user has access to this mentee
  // For instructors: check if they have an active mentorship with this mentee
  // For admins: allow any mentee
  if (role === "instructor") {
    const { data: instructorData, error: instructorErr } = await supabase
      .from("instructors")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();
    
    if (instructorErr || !instructorData) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }
    
    // Check if instructor has an active mentorship with this mentee
    const { data: mentorship, error: mentorshipErr } = await supabase
      .from("mentorships")
      .select("id")
      .eq("mentee_id", menteeId)
      .eq("instructor_id", instructorData.id)
      .eq("status", "active")
      .maybeSingle();
    
    if (mentorshipErr || !mentorship) {
      return NextResponse.json({ error: "Forbidden: No active mentorship with this mentee" }, { status: 403 });
    }
  }
  
  // Update the display_name
  const { data, error } = await supabase
    .from("mentees")
    .update({ display_name: displayName || null })
    .eq("id", menteeId)
    .select("display_name")
    .maybeSingle();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ display_name: data?.display_name || null });
}

