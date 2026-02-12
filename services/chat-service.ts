import type { ChatMessage, DocumentSource } from "@/types";

export interface ChatApiResponse {
  conversationId: string;
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

export interface ConversationSummary {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Send a chat message to the API and get an AI response.
 */
export async function sendChatMessage(
  query: string,
  conversationId?: string
): Promise<ChatApiResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, conversationId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Chat failed" }));
    throw new Error(err.error ?? "Failed to get response");
  }

  return res.json();
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

