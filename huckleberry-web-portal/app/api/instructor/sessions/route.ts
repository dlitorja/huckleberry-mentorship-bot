import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

const IncDecSchema = z.object({
  mentorshipId: z.string().uuid(),
  delta: z.number().int().min(-10).max(10)
});

const ScheduleSchema = z.object({
  mentorshipId: z.string().uuid(),
  instructorId: z.string().uuid().optional(),
  menteeId: z.string().uuid().optional(),
  scheduledAtUtc: z.string(), // ISO
  durationMinutes: z.number().int().min(15).max(300)
});

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = String((token as any).role || "unknown");
  const discordId = String((token as any).discordId || "");
  if (role !== "instructor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = getSupabaseClient(true);
  const body = await req.json().catch(() => ({}));

  if (body?.action === "incdec") {
    const parsed = IncDecSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const { mentorshipId, delta } = parsed.data;
    const { data: current, error: readErr } = await supabase
      .from("mentorships")
      .select("sessions_remaining, instructor_discord_id")
      .eq("id", mentorshipId)
      .maybeSingle();
    if (readErr || !current) return NextResponse.json({ error: readErr?.message || "Not found" }, { status: 404 });
    if (role === "instructor" && current.instructor_discord_id !== discordId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const next = Math.max(0, (current.sessions_remaining ?? 0) + delta);
    const { error: updErr } = await supabase
      .from("mentorships")
      .update({ sessions_remaining: next })
      .eq("id", mentorshipId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ sessions_remaining: next });
  }

  if (body?.action === "schedule") {
    const parsed = ScheduleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const { mentorshipId, instructorId, menteeId, scheduledAtUtc, durationMinutes } = parsed.data;

    let instrId = instructorId;
    let mentId = menteeId;
    if (!instrId || !mentId) {
      const { data: mrow, error: merr } = await supabase
        .from("mentorships")
        .select("instructor_id, mentee_id, instructor_discord_id")
        .eq("id", mentorshipId)
        .maybeSingle();
      if (merr || !mrow) return NextResponse.json({ error: "Mentorship not found" }, { status: 404 });
      if (role === "instructor" && mrow.instructor_discord_id !== discordId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      instrId = mrow.instructor_id;
      mentId = mrow.mentee_id;
    }
    const { data, error } = await supabase
      .from("scheduled_sessions")
      .insert({
        mentorship_id: mentorshipId,
        instructor_id: instrId,
        mentee_id: mentId,
        scheduled_at_utc: scheduledAtUtc,
        duration_minutes: durationMinutes
      })
      .select("id")
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: error?.message || "Insert failed" }, { status: 500 });
    return NextResponse.json({ scheduled_session_id: data.id });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

