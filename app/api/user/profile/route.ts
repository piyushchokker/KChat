import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/user/profile
 *
 * Returns the current user's profile from Supabase.
 */
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("users")
    .select("*, schools(name), courses(name)")
    .eq("auth_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "User not found in database" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/user/profile
 *
 * Update user profile fields (program, department, designation).
 */
export async function PATCH(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const allowedFields = ["course_code", "school_code", "name"];
  const updates: Record<string, string> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("users")
    .update(updates)
    .eq("auth_id", user.id)
    .select("*, schools(name), courses(name)")
    .single();

  if (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Audit log
  await admin.from("audit_logs").insert({
    user_id: data.id,
    action: "profile_updated",
    entity_type: "user",
    entity_id: data.id,
    metadata: updates,
  });

  return NextResponse.json(data);
}
