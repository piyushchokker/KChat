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

  // Verify ownership
  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

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

  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

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
