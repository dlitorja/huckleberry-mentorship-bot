import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { auth } from "@/auth";

// GET comments for an image
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: imageId } = await params;
    const supabase = getSupabaseClient(true);

    // Verify user has access to the image
    const { data: image, error: imageError } = await supabase
      .from("session_images")
      .select("mentorship_id")
      .eq("id", imageId)
      .maybeSingle();

    if (imageError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Get comments for this image
    const { data: comments, error: commentsError } = await supabase
      .from("image_comments")
      .select("id, user_discord_id, user_type, comment, created_at, updated_at")
      .eq("image_id", imageId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      console.error("[Image Comments API] Error fetching comments:", commentsError);
      return NextResponse.json({ error: commentsError.message }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    console.error("[Image Comments API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST a new comment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !(session.user as any)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: imageId } = await params;
    const discordId = String((session.user as any).id);
    const role = String((session as any).role || "unknown");
    const userType = role === "student" ? "student" : role === "instructor" ? "instructor" : "admin";

    const body = await req.json().catch(() => ({}));
    const { comment } = body;

    if (!comment || !comment.trim()) {
      return NextResponse.json({ error: "Comment is required" }, { status: 400 });
    }

    const supabase = getSupabaseClient(true);

    // Verify user has access to the image
    const { data: image, error: imageError } = await supabase
      .from("session_images")
      .select("mentorship_id")
      .eq("id", imageId)
      .maybeSingle();

    if (imageError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Verify access to mentorship (same logic as image upload)
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
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Create the comment
    const { data: newComment, error: insertError } = await supabase
      .from("image_comments")
      .insert({
        image_id: imageId,
        user_discord_id: discordId,
        user_type: userType,
        comment: comment.trim(),
      })
      .select("id, user_discord_id, user_type, comment, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("[Image Comments API] Error creating comment:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ comment: newComment });
  } catch (error) {
    console.error("[Image Comments API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

