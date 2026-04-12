import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { getFrontendMetadataOptions } from "@/lib/document-metadata-options";

/**
 * GET /api/documents/metadata-options
 *
 * Returns dynamic school/course/document-type options used by document UI.
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: currentUser } = await admin
    .from("users")
    .select("id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (currentUser.is_allowed === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const options = await getFrontendMetadataOptions(admin);
    return NextResponse.json(
      { options },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch document metadata options:", error);
    return NextResponse.json(
      { error: "Failed to fetch document metadata options" },
      { status: 500 }
    );
  }
}
