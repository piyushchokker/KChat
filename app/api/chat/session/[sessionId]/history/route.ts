import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RetHistoryMessage = {
  id: string;
  role: string;
  content: string;
  timestamp: string;
};

/**
 * GET /api/chat/session/[sessionId]/history
 *
 * Returns RET message history for a specific UUID session.
 */
export async function GET(_req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const admin = createAdminClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const normalizedSessionId = sessionId.trim().toLowerCase();

  if (!UUID_PATTERN.test(normalizedSessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

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

  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("ret_session_id", normalizedSessionId)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json(
      { error: "Failed to resolve session conversation" },
      { status: 500 }
    );
  }

  if (!conversation) {
    return NextResponse.json({ sessionId: normalizedSessionId, messages: [] });
  }

  const { data: messages, error: messagesError } = await admin
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return NextResponse.json(
      { error: "Failed to load session history" },
      { status: 500 }
    );
  }

  const normalizedMessages: RetHistoryMessage[] = (messages ?? [])
    .map((message) => ({
      id: message.id,
      role: typeof message.role === "string" ? message.role : "",
      content: typeof message.content === "string" ? message.content : "",
      timestamp: message.created_at,
    }))
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.content.trim().length > 0
    );

  return NextResponse.json({
    sessionId: normalizedSessionId,
    messages: normalizedMessages,
  });
}
