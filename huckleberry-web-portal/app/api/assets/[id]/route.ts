import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = String((token as any).role || "unknown");
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseClient(true);

  try {
    // List files to find the one matching this ID
    const { data: files, error: listError } = await supabase.storage
      .from("landing-page-assets")
      .list("", {
        limit: 1000,
      });

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Find file that starts with the ID
    const fileToDelete = files?.find((file) => file.name.startsWith(id));

    if (!fileToDelete) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete the file
    const { error: deleteError } = await supabase.storage
      .from("landing-page-assets")
      .remove([fileToDelete.name]);

    if (deleteError) {
      console.error("[Asset Delete] Storage error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Asset Delete] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

