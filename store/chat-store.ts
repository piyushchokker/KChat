"use client";

import { create } from "zustand";
import type { ChatMessage } from "@/types";
import {
  sendChatMessage,
  getConversations,
  getConversationMessages,
  deleteConversation,
  type ConversationSummary,
} from "@/services/chat-service";

interface ChatState {
  messages: ChatMessage[];
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;

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
  isLoading: false,
  error: null,

  sendMessage: async (query) => {
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await sendChatMessage(
        query,
        get().activeConversationId ?? undefined
      );

      // Replace temp user message and add assistant message
      set((state) => ({
        activeConversationId: response.conversationId,
        messages: [
          ...state.messages.filter((m) => m.id !== userMessage.id),
          {
            id: response.userMessage.id,
            role: "user" as const,
            content: response.userMessage.content,
            timestamp: new Date(response.userMessage.timestamp),
          },
          {
            id: response.assistantMessage.id,
            role: "assistant" as const,
            content: response.assistantMessage.content,
            timestamp: new Date(response.assistantMessage.timestamp),
          },
        ],
        isLoading: false,
      }));

      // Refresh conversations list
      get().loadConversations();
    } catch (err) {
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
      error: null,
    }),
}));
