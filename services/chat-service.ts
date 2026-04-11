import type { ChatMessage, DocumentSource } from "@/types";

export interface ChatApiResponse {
  conversationId: string;
  sessionId?: string;
  ragUsed?: boolean;
  ragRouterDecision?: "true" | "false" | "none";
  userMessage: {
    id: string;
    role: string;
    content: string;
    timestamp: string;
  };
  assistantMessage: {
    id: string;
    role: string;
    content: string;
    timestamp: string;
    sources?: DocumentSource[];
    confidence?: number;
  };
}

export interface ChatStreamMeta {
  conversationId: string;
  sessionId?: string;
  userMessage: {
    id: string;
    role: string;
    content: string;
    timestamp: string;
  };
}

export interface ChatStreamDone {
  sessionId?: string;
  ragUsed?: boolean;
  ragRouterDecision?: "true" | "false" | "none";
  assistantMessage: {
    id: string;
    role: string;
    content: string;
    timestamp: string;
    sources?: DocumentSource[];
    confidence?: number;
  };
}

export interface SendChatMessageStreamHandlers {
  onMeta?: (meta: ChatStreamMeta) => void;
  onDelta?: (delta: string) => void;
  onDone?: (done: ChatStreamDone) => void;
}

export interface ConversationSummary {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RetHistoryMessage {
  role: string;
  content: string;
  timestamp?: string | number | null;
}

interface RetHistoryResponse {
  sessionId: string;
  messages: RetHistoryMessage[];
}

function parseSseEvent(block: string): { event: string; data: string } | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * Send a chat message and consume AI response as a stream.
 */
export async function sendChatMessageStream(
  query: string,
  conversationId: string | undefined,
  sessionId: string | undefined,
  handlers: SendChatMessageStreamHandlers
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, conversationId, sessionId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Chat failed" }));
    throw new Error(err.error ?? "Failed to get response");
  }

  // Backward-compatible fallback in case the server returns JSON.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const data = (await res.json()) as ChatApiResponse;
    handlers.onMeta?.({
      conversationId: data.conversationId,
      sessionId: data.sessionId,
      userMessage: data.userMessage,
    });
    handlers.onDelta?.(data.assistantMessage.content);
    handlers.onDone?.({
      assistantMessage: data.assistantMessage,
      sessionId: data.sessionId,
    });
    return;
  }

  if (!res.body) {
    throw new Error("No response stream received");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseEvent(block);
      if (!parsed) continue;

      if (parsed.event === "delta") {
        const payload = JSON.parse(parsed.data) as { text?: string };
        if (payload.text) handlers.onDelta?.(payload.text);
      } else if (parsed.event === "meta") {
        handlers.onMeta?.(JSON.parse(parsed.data) as ChatStreamMeta);
      } else if (parsed.event === "done") {
        handlers.onDone?.(JSON.parse(parsed.data) as ChatStreamDone);
      } else if (parsed.event === "error") {
        const payload = JSON.parse(parsed.data) as { message?: string };
        throw new Error(payload.message ?? "Streaming failed");
      }
    }
  }
}

/**
 * Get all conversations for the current user.
 */
export async function getConversations(): Promise<ConversationSummary[]> {
  const res = await fetch("/api/chat/conversations");
  if (!res.ok) return [];
  return res.json();
}

/**
 * Get all messages for a specific conversation.
 */
export async function getConversationMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  const res = await fetch(`/api/chat/conversations/${conversationId}`);
  if (!res.ok) return [];

  const data = await res.json();
  return data.map((m: { id: string; role: string; content: string; timestamp: string }) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: new Date(m.timestamp),
  }));
}

/**
 * Delete (deactivate) a conversation.
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  await fetch(`/api/chat/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

function toMessageDate(timestamp: string | number | null | undefined): Date {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp);
  }

  if (typeof timestamp === "string") {
    const trimmed = timestamp.trim();

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number.parseInt(trimmed, 10);
      if (Number.isFinite(numeric)) {
        return new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
      }
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  return new Date();
}

/**
 * Get RET chat history for a specific session id.
 */
export async function getRetSessionHistory(
  sessionId: string
): Promise<ChatMessage[]> {
  const normalizedSessionId = sessionId.trim().toLowerCase();

  if (!normalizedSessionId) {
    return [];
  }

  const res = await fetch(
    `/api/chat/session/${encodeURIComponent(normalizedSessionId)}/history`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: "Failed to load session history" }));
    throw new Error(err.error ?? "Failed to load session history");
  }

  const payload = (await res.json()) as RetHistoryResponse;
  const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];

  return rawMessages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message, index) => ({
      id: `${normalizedSessionId}-${index}-${message.role}`,
      role: message.role as "user" | "assistant",
      content: message.content,
      timestamp: toMessageDate(message.timestamp),
    }));
}

