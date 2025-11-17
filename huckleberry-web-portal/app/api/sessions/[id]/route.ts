import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseClient(true);
  const { data, error } = await supabase
    .from("session_notes")
    .select("id, mentorship_id, notes, session_date, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });

  const { data: images } = await supabase
    .from("session_images")
    .select("id, image_url, thumbnail_url, caption, uploader_type, created_at")
    .eq("session_note_id", id);

  return NextResponse.json({ session: data, images: images || [] });
}

