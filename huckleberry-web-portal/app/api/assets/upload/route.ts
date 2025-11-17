import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = String((token as any).role || "unknown");
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  const form = await req.formData();
  const files = form.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const supabase = getSupabaseClient(true);
  const uploadedAssets: Array<{
    id: string;
    url: string;
    name: string;
    size: number;
    uploadedAt: string;
  }> = [];
  const errors: string[] = [];

  for (const file of files) {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      errors.push(`${file.name}: Not an image file`);
      continue;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      errors.push(`${file.name}: File too large (max 10MB)`);
      continue;
    }

    try {
      const assetId = randomUUID();
      const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      
      // Upload to public assets bucket
      const path = `landing-page-assets/${assetId}-${sanitizedName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadErr } = await supabase.storage
        .from("landing-page-assets")
        .upload(path, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) {
        console.error("[Asset Upload] Storage error:", uploadErr);
        errors.push(`Failed to upload ${file.name}: ${uploadErr.message}`);
        continue;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("landing-page-assets")
        .getPublicUrl(path);

      uploadedAssets.push({
        id: assetId,
        url: publicUrlData.publicUrl,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Asset Upload] Unexpected error:", error);
      errors.push(
        `Failed to process ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  if (uploadedAssets.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({
    assets: uploadedAssets,
    uploadedCount: uploadedAssets.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

