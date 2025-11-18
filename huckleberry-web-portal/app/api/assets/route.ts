import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = String((session as any).role || "unknown");
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  const supabase = getSupabaseClient(true);

  try {
    // List all files in the landing-page-assets bucket
    const { data: files, error } = await supabase.storage
      .from("landing-page-assets")
      .list("", {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("[Assets List] Storage error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URLs for all files
    const assets = (files || [])
      .filter((file: { name: string }) => file.name) // Filter out folders
      .map((file: { name: string; metadata?: any; created_at?: string }) => {
        const { data: publicUrlData } = supabase.storage
          .from("landing-page-assets")
          .getPublicUrl(file.name);

        // Extract original filename (everything after the UUID and first dash)
        // Format: {uuid}-{sanitized-filename}
        const nameParts = file.name.split("-");
        const originalName = nameParts.length > 1 ? nameParts.slice(1).join("-") : file.name;
        const assetId = nameParts[0] || file.name; // Fallback to full filename if no UUID found

        return {
          id: assetId,
          url: publicUrlData.publicUrl,
          name: originalName,
          size: file.metadata?.size || 0,
          uploadedAt: file.created_at || new Date().toISOString(),
        };
      });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("[Assets List] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

