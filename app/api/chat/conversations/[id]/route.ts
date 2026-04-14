import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chat/conversations/[id]
 *
 * Get all messages for a specific conversation.
 */
export async function GET(_req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();

  // Verify ownership with robust user resolution:
  // 1) auth_id lookup
  // 2) email fallback for older rows that may miss auth_id
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

    // Best-effort backfill so future lookups can use auth_id directly.
    if (user && !user.auth_id) {
      await admin.from("users").update({ auth_id: authUser.id }).eq("id", user.id);
    }
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!conv) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const { data: messages, error } = await admin
    .from("messages")
    .select("id, role, content, sources, confidence, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      sources: m.sources,
      confidence: m.confidence,
    }))
  );
}

/**
 * DELETE /api/chat/conversations/[id]
 *
 * Soft-delete (deactivate) a conversation.
 */
export async function DELETE(_req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
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

  const { error } = await admin
    .from("conversations")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
