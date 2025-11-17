import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { getToken } from "next-auth/jwt";

const IMAGE_LIMIT = 75; // Maximum images per mentorship (shared across all sessions) for non-admins

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const role = String((token as any).role || "unknown");
  const isAdmin = role === "admin";
  const form = await req.formData();
  const mentorshipId = String(form.get("mentorshipId") || "");
  const sessionNoteId = form.get("sessionNoteId") ? String(form.get("sessionNoteId")) : null;
  
  // Get compressed images and thumbnails (new format)
  const compressedFiles = form.getAll("compressed") as File[];
  const thumbnailFiles = form.getAll("thumbnails") as File[];
  const originalSizes = form.getAll("originalSizes").map(s => parseInt(String(s)));
  const compressedSizes = form.getAll("compressedSizes").map(s => parseInt(String(s)));
  const thumbnailSizes = form.getAll("thumbnailSizes").map(s => parseInt(String(s)));

  // Fallback to old format for backwards compatibility
  const legacyFiles = form.getAll("files") as File[];

  const files = compressedFiles.length > 0 ? compressedFiles : legacyFiles;
  const hasThumbnails = thumbnailFiles.length > 0;

  if (!mentorshipId || files.length === 0) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const supabase = getSupabaseClient(true);
  
  // Verify user has access to this mentorship
  const discordId = String((token as any).discordId || "");
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
  } else if (role === "instructor" || role === "admin") {
    const { data: instructorData } = await supabase
      .from("instructors")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();
    
    if (!instructorData && role !== "admin") {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    // For admins, skip verification. For instructors, verify mentorship
    if (role === "instructor") {
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
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check image limit for non-admins
  // The 25 image limit is shared across ALL sessions for this mentorship
  if (!isAdmin) {
    // Count ALL existing images for this mentorship (across all sessions)
    const { count: currentCount, error: countError } = await supabase
      .from("session_images")
      .select("id", { count: "exact", head: true })
      .eq("mentorship_id", mentorshipId);

    if (countError) {
      console.error('[Image Upload] Count error:', countError);
      return NextResponse.json({ error: "Failed to check image count" }, { status: 500 });
    }

    const currentImageCount = currentCount || 0;
    if (currentImageCount + files.length > IMAGE_LIMIT) {
      return NextResponse.json({ 
        error: `Image limit reached. You have ${currentImageCount}/${IMAGE_LIMIT} images for this mentorship (shared across all sessions). Cannot upload ${files.length} more.` 
      }, { status: 400 });
    }
  }

  const uploaded: string[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const thumbnail = hasThumbnails && thumbnailFiles[i] ? thumbnailFiles[i] : null;
    const originalSize = originalSizes[i] || file.size;
    const compressedSize = compressedSizes[i] || file.size;
    const thumbnailSize = thumbnailSizes[i] || 0;

    try {
      const imageId = randomUUID();
      const fileExtension = 'webp'; // Always use webp for compressed images
      
      // Upload compressed original image
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const originalPath = `mentorship-images/${mentorshipId}/${sessionNoteId ?? "general"}/${imageId}.${fileExtension}`;
      
      const { error: uploadErr } = await supabase.storage.from("mentorship-images").upload(originalPath, buffer, {
        contentType: 'image/webp',
        upsert: false
      });
      
      if (uploadErr) {
        console.error('[Image Upload] Storage error:', uploadErr);
        errors.push(`Failed to upload ${file.name}: ${uploadErr.message}`);
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from("mentorship-images").getPublicUrl(originalPath);
      let thumbnailUrl: string | null = null;

      // Upload thumbnail if available
      if (thumbnail) {
        const thumbnailArrayBuffer = await thumbnail.arrayBuffer();
        const thumbnailBuffer = Buffer.from(thumbnailArrayBuffer);
        const thumbnailPath = `mentorship-images/${mentorshipId}/${sessionNoteId ?? "general"}/${imageId}_thumb.${fileExtension}`;
        
        const { error: thumbUploadErr } = await supabase.storage.from("mentorship-images").upload(thumbnailPath, thumbnailBuffer, {
          contentType: 'image/webp',
          upsert: false
        });
        
        if (!thumbUploadErr) {
          const { data: thumbUrlData } = supabase.storage.from("mentorship-images").getPublicUrl(thumbnailPath);
          thumbnailUrl = thumbUrlData.publicUrl;
        } else {
          console.error('[Image Upload] Thumbnail upload error:', thumbUploadErr);
          // Continue without thumbnail
        }
      }

      uploaded.push(publicUrlData.publicUrl);

      // Insert into database
      const { error: insertErr } = await supabase.from("session_images").insert({
        mentorship_id: mentorshipId,
        session_note_id: sessionNoteId,
        image_url: publicUrlData.publicUrl,
        thumbnail_url: thumbnailUrl,
        uploader_type: role === "student" ? "student" : "instructor",
        file_size: compressedSize
      });

      if (insertErr) {
        console.error('[Image Upload] Database error:', insertErr);
        errors.push(`Failed to save ${file.name}: ${insertErr.message}`);
        // Try to clean up uploaded file
        await supabase.storage.from("mentorship-images").remove([originalPath]);
        if (thumbnailUrl) {
          const thumbnailPath = `mentorship-images/${mentorshipId}/${sessionNoteId ?? "general"}/${imageId}_thumb.webp`;
          await supabase.storage.from("mentorship-images").remove([thumbnailPath]);
        }
      }
    } catch (error) {
      console.error('[Image Upload] Unexpected error:', error);
      errors.push(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (uploaded.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({ 
    uploaded, 
    uploadedCount: uploaded.length,
    errors: errors.length > 0 ? errors : undefined 
  });
}

