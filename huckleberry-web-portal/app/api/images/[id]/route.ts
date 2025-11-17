import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";

// DELETE /api/images/[id] - Delete an image
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = String((token as any).role || "unknown");
  const discordId = String((token as any).discordId || "");
  const supabase = getSupabaseClient(true);
  const { id: imageId } = await params;

  // First, get the image to check ownership and get the mentorship_id
  const { data: image, error: imageError } = await supabase
    .from("session_images")
    .select("id, mentorship_id, image_url, thumbnail_url, uploader_type, session_note_id")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError || !image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
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
      .eq("id", image.mentorship_id)
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
      .eq("id", image.mentorship_id)
      .eq("instructor_id", instructorData.id)
      .eq("status", "active")
      .maybeSingle();

    if (!mentorship) {
      return NextResponse.json({ error: "Mentorship not found or access denied" }, { status: 403 });
    }
  } else if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Extract the file paths from the image URLs
  // URL format: https://[project].supabase.co/storage/v1/object/public/mentorship-images/path/to/file
  const urlParts = image.image_url.split("/mentorship-images/");
  if (urlParts.length < 2) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }
  const filePath = `mentorship-images/${urlParts[1]}`;
  
  const pathsToDelete = [filePath];
  
  // Also delete thumbnail if it exists
  if (image.thumbnail_url) {
    const thumbUrlParts = image.thumbnail_url.split("/mentorship-images/");
    if (thumbUrlParts.length >= 2) {
      pathsToDelete.push(`mentorship-images/${thumbUrlParts[1]}`);
    }
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("mentorship-images")
    .remove(pathsToDelete);

  if (storageError) {
    console.error("[Image Delete] Storage error:", storageError);
    // Continue with database deletion even if storage deletion fails
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from("session_images")
    .delete()
    .eq("id", imageId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

