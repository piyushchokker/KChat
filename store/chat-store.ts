"use client";

import { create } from "zustand";
import type { ChatMessage } from "@/types";
import {
  sendChatMessageStream,
  getConversations,
  getConversationMessages,
  deleteConversation,
  getRetSessionHistory,
  type ConversationSummary,
} from "@/services/chat-service";

interface ChatState {
  messages: ChatMessage[];
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  retSessionId: string | null;
  lastRagUsed: boolean | null;
  lastRagRouterDecision: "true" | "false" | "none" | null;
  isLoading: boolean;
  error: string | null;

  initializeRetSession: (sessionId?: string | null) => void;
  loadRetSessionHistory: (sessionId: string) => Promise<void>;
  sendMessage: (query: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  startNewConversation: () => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversations: [],
  activeConversationId: null,
  retSessionId: null,
  lastRagUsed: null,
  lastRagRouterDecision: null,
  isLoading: false,
  error: null,

  initializeRetSession: (sessionId) => {
    const incoming = typeof sessionId === "string" ? sessionId.trim() : "";

    if (incoming.length > 0) {
      // Always reset conversation context on explicit session-route init.
      // This prevents stale conversation/session mismatches after viewing read-only history.
      set({
        retSessionId: incoming,
        activeConversationId: null,
        messages: [],
        lastRagUsed: null,
        lastRagRouterDecision: null,
        error: null,
      });
      return;
    }

    if (!get().retSessionId) {
      set({ retSessionId: null });
    }
  },

  loadRetSessionHistory: async (sessionId) => {
    const normalized = sessionId.trim().toLowerCase();

    if (!normalized) {
      set({ messages: [] });
      return;
    }

    const initialMessageCount = get().messages.length;

    set({ isLoading: true, error: null });

    try {
      const historyMessages = await getRetSessionHistory(normalized);

      set((state) => {
        if (state.retSessionId !== normalized) {
          return state;
        }

        // Prevent late history fetches from overwriting in-flight/new messages.
        if (state.messages.length !== initialMessageCount) {
          return { isLoading: false };
        }

        return {
          messages: historyMessages,
          isLoading: false,
          error: null,
        };
      });
    } catch (err) {
      set((state) => {
        if (state.retSessionId !== normalized) {
          return state;
        }

        return {
          isLoading: false,
          error:
            err instanceof Error ? err.message : "Failed to load chat history",
        };
      });
    }
  },

  sendMessage: async (query) => {
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `temp-user-${now}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    const assistantMessageId = `temp-assistant-${now}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantPlaceholder],
      lastRagUsed: null,
      lastRagRouterDecision: null,
      isLoading: true,
      error: null,
    }));

    try {
      await sendChatMessageStream(
        query,
        get().activeConversationId ?? undefined,
        get().retSessionId ?? undefined,
        {
          onMeta: (meta) => {
            set((state) => ({
              activeConversationId: meta.conversationId,
              retSessionId: meta.sessionId ?? state.retSessionId,
              messages: state.messages.map((m) => {
                if (m.id === userMessage.id) {
                  return {
                    id: meta.userMessage.id,
                    role: "user" as const,
                    content: meta.userMessage.content,
                    timestamp: new Date(meta.userMessage.timestamp),
                  };
                }
                return m;
              }),
            }));
          },
          onDelta: (delta) => {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + delta }
                  : m
              ),
            }));
          },
          onDone: (done) => {
            set((state) => ({
              retSessionId: done.sessionId ?? state.retSessionId,
              lastRagUsed: done.ragUsed ?? null,
              lastRagRouterDecision: done.ragRouterDecision ?? null,
              messages: state.messages.map((m) =>
                m.id === assistantMessageId
                  ? {
                      id: done.assistantMessage.id,
                      role: "assistant" as const,
                      content: done.assistantMessage.content,
                      timestamp: new Date(done.assistantMessage.timestamp),
                    }
                  : m
              ),
              isLoading: false,
            }));
          },
        }
      );

      set({ isLoading: false });

      // Refresh conversations list
      get().loadConversations();
    } catch (err) {
      // Remove empty assistant placeholder if stream failed before content.
      set((state) => ({
        messages: state.messages.filter(
          (m) => !(m.id === assistantMessageId && m.content.length === 0)
        ),
      }));
      set({
        error: err instanceof Error ? err.message : "Failed to get response",
        isLoading: false,
      });
    }
  },

  loadConversations: async () => {
    try {
      const conversations = await getConversations();
      set({ conversations });
    } catch {
      // Silently fail — conversations sidebar is not critical
    }
  },

  loadConversation: async (conversationId) => {
    set({ isLoading: true, error: null });
    try {
      const messages = await getConversationMessages(conversationId);
      set({
        messages,
        activeConversationId: conversationId,
        isLoading: false,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to load conversation",
        isLoading: false,
      });
    }
  },

  startNewConversation: () => {
    set({
      messages: [],
      activeConversationId: null,
      lastRagUsed: null,
      lastRagRouterDecision: null,
      error: null,
    });
  },

  deleteConversation: async (conversationId) => {
    try {
      await deleteConversation(conversationId);
      const currentId = get().activeConversationId;
      if (currentId === conversationId) {
        set({ messages: [], activeConversationId: null });
      }
      // Refresh list
      get().loadConversations();
    } catch {
      // Silently fail
    }
  },

  clearChat: () =>
    set({
      messages: [],
      activeConversationId: null,
      lastRagUsed: null,
      lastRagRouterDecision: null,
      error: null,
    }),
}));
