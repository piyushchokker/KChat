"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useChatStore } from "@/store/chat-store";
import { useAuthStore } from "@/store/auth-store";
import ChatMessageBubble from "./chat-message";
import ChatInput, { type ChatInputRef } from "./chat-input";
import SuggestedQuestions from "./suggested-questions";
import { SUGGESTED_QUESTIONS, APP_NAME } from "@/utils/constants";

interface ChatContainerProps {
  initialRetSessionId?: string | null;
  historyConversationId?: string | null;
  isReadOnlyHistory?: boolean;
}

export default function ChatContainer({
  initialRetSessionId,
  historyConversationId,
  isReadOnlyHistory = false,
}: ChatContainerProps) {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    initializeRetSession,
    loadRetSessionHistory,
    loadConversation,
    lastRagUsed,
    lastRagRouterDecision,
  } = useChatStore();
  const { syncWithSupabase, isSynced } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);

  useEffect(() => {
    if (isReadOnlyHistory && historyConversationId?.trim()) {
      initializeRetSession(initialRetSessionId);
      void loadConversation(historyConversationId.trim());
      return;
    }

    initializeRetSession(initialRetSessionId);

    if (initialRetSessionId?.trim()) {
      void loadRetSessionHistory(initialRetSessionId);
    }
  }, [
    historyConversationId,
    initialRetSessionId,
    initializeRetSession,
    isReadOnlyHistory,
    loadConversation,
    loadRetSessionHistory,
  ]);

  // Sync user with Supabase on first load
  useEffect(() => {
    if (!isSynced) {
      syncWithSupabase();
    }
  }, [isSynced, syncWithSupabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-focus input after AI responds
  useEffect(() => {
    if (isReadOnlyHistory) {
      return;
    }

    if (!isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 100);
      }
    }
  }, [isReadOnlyHistory, messages, isLoading]);

  const handleSend = (query: string) => {
    if (isReadOnlyHistory) {
      return;
    }

    sendMessage(query);
  };

  const isEmpty = messages.length === 0;
  const inputDisabled = isLoading || isReadOnlyHistory;
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showThinking = isLoading && (!latestAssistant || latestAssistant.content.trim().length === 0);
  const visibleMessages = messages.filter(
    (m) => !(m.role === "assistant" && m.content.trim().length === 0)
  );
  const showRoutingStatus =
    !isReadOnlyHistory &&
    (lastRagRouterDecision !== null || lastRagUsed !== null);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Background image */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/krmu_kchat_bg.jpg"
          alt=""
          fill
          loading="eager"
          className="object-cover opacity-10"
          aria-hidden
        />
      </div>
      {/* Messages area */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 sm:px-8">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-6 pt-10">
            {isReadOnlyHistory ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-200">Chat History</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                  {isLoading
                    ? "Loading saved conversation..."
                    : "No messages found for this conversation."}
                </p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                    Welcome to {APP_NAME}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                    I&apos;m here to help you with your questions and information.
                  </p>
                </div>

                <div className="w-full max-w-md">
                  <SuggestedQuestions
                    questions={SUGGESTED_QUESTIONS}
                    onSelect={handleSend}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            {visibleMessages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}

            {showThinking && (
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:300ms]" />
                </div>
                Searching...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!isReadOnlyHistory ? (
        <div className="relative z-10 border-t border-gray-100 bg-white/90 px-4 py-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 sm:px-8">
          <div className="mx-auto max-w-4xl">
            {showRoutingStatus ? (
              <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">
                Router: {lastRagRouterDecision ?? "unknown"} | RAG used: {lastRagUsed === null ? "unknown" : String(lastRagUsed)}
              </p>
            ) : null}
            {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
            <ChatInput ref={chatInputRef} onSend={handleSend} disabled={inputDisabled} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
