import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/auth/sync
 *
 * Ensures the current Supabase user exists in the users table.
 * Called on first login or when user data needs refreshing.
 */
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const email = user.email ?? "";
  const meta = user.user_metadata ?? {};

  // Microsoft Azure: extract actual name (strip roll number from full_name)
  const rawName = meta.given_name || meta.name || meta.full_name || email;
  const name = rawName.replace(/\d+/g, "").trim();
  // Roll number = part before "@" in the email (e.g. 2501940081@krmu.edu.in)
  const rollNumber = email.includes("@") ? email.split("@")[0] : null;

  // Determine role
  const role =
    email.includes("registrar") ||
    email.includes("admin") ||
    email.includes("office")
      ? "registrar"
      : "student";

  // Upsert user into Supabase
  const { data, error } = await admin
    .from("users")
    .upsert(
      {
        auth_id: user.id,
        email,
        name,
        role,
        roll_number: role === "student" ? rollNumber : null,
        image_url: meta.avatar_url ?? null,
      },
      { onConflict: "auth_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to sync user:", error);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
