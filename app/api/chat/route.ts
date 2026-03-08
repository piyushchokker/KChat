import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

/**
 * POST /api/chat
 *
 * Send a chat message and get an AI response.
 * Persists both user and assistant messages to Supabase.
 *
 * Body: { query: string, conversationId?: string }
 */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get internal user
  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { query, conversationId } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Query is required" },
      { status: 400 }
    );
  }

  let activeConversationId = conversationId;

  // Create new conversation if none provided
  if (!activeConversationId) {
    const title =
      query.length > 50 ? query.substring(0, 50) + "..." : query;

    const { data: conv, error: convError } = await admin
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    activeConversationId = conv.id;
  } else {
    // Verify conversation belongs to user
    const { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
  }

  // Save user message
  const { data: userMsg, error: userMsgError } = await admin
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      role: "user",
      content: query.trim(),
    })
    .select()
    .single();

  if (userMsgError) {
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }

  // ================================================
  // AI RESPONSE — Python RAG backend
  // ================================================
  const aiResponse = await callPythonBackend(query);

  // Save assistant message
  const { data: assistantMsg, error: assistantMsgError } = await admin
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      role: "assistant",
      content: aiResponse.answer,
      sources: aiResponse.sources,
      confidence: aiResponse.confidence,
    })
    .select()
    .single();

  if (assistantMsgError) {
    return NextResponse.json(
      { error: "Failed to save response" },
      { status: 500 }
    );
  }

  // Update conversation title and updated_at
  await admin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", activeConversationId);

  return NextResponse.json({
    conversationId: activeConversationId,
    userMessage: {
      id: userMsg.id,
      role: userMsg.role,
      content: userMsg.content,
      timestamp: userMsg.created_at,
    },
    assistantMessage: {
      id: assistantMsg.id,
      role: assistantMsg.role,
      content: assistantMsg.content,
      timestamp: assistantMsg.created_at,
      sources: assistantMsg.sources,
      confidence: assistantMsg.confidence,
    },
  });
}

// ----- Python RAG backend caller -----

async function callPythonBackend(query: string) {
  const backendUrl = process.env.PYTHON_BACKEND_URL;
  if (!backendUrl) {
    console.error("[Python Backend Error] PYTHON_BACKEND_URL is not set");
    return {
      answer: "I'm sorry, the knowledge base is not configured. Please contact support.",
      confidence: 0,
      sources: [],
    };
  }

  try {
    const res = await fetch(
      backendUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!res.ok) {
      throw new Error(`Backend responded with ${res.status}`);
    }

    const data = await res.json();

    // Support common response field names from Python backends
    const rawAnswer =
      data.answer ?? data.response ?? data.message ?? data.text ?? data;
    const answer =
      typeof rawAnswer === "string" ? rawAnswer : JSON.stringify(rawAnswer);

    return {
      answer,
      confidence: typeof data.confidence === "number" ? data.confidence : 0.9,
      sources: Array.isArray(data.sources) ? data.sources : [],
    };
  } catch (err) {
    console.error("[Python Backend Error]", err instanceof Error ? err.message : String(err));
    return {
      answer:
        "I'm sorry, I couldn't reach the knowledge base right now. Please try again in a moment.",
      confidence: 0,
      sources: [],
    };
  }
}
