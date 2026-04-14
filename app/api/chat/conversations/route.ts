import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

/**
 * GET /api/chat/conversations
 *
 * List all conversations for the current user.
 */
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();

  const { data: byAuthId } = await admin
    .from("users")
    .select("id, auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();

  let user = byAuthId;

  if (!user && normalizedEmail) {
    const { data: byEmail } = await admin
      .from("users")
      .select("id, auth_id")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    user = byEmail;

    if (user && !user.auth_id) {
      await admin.from("users").update({ auth_id: authUser.id }).eq("id", user.id);
    }
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("conversations")
    .select("id, title, is_active, ret_session_id, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
