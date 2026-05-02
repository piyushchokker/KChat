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
    lastTicketRaised,
    lastRaisedTicketId,
    ticketRaisedAt,
    currentStatusMessage,
  } = useChatStore();
  const { syncWithSupabase, isSynced } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
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
    if (messages.length !== lastMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      lastMessageCountRef.current = messages.length;
    }
  }, [messages.length]);

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
  const latestAssistantContent = latestAssistant?.content ?? "";
  const showThinking = isLoading && (!latestAssistant || latestAssistantContent.trim().length === 0);
  const visibleMessages = messages.filter(
    (m) => !(m.role === "assistant" && (m.content ?? "").trim().length === 0)
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {lastTicketRaised ? (
        <div
          key={ticketRaisedAt ?? undefined}
          className="pointer-events-none absolute left-1/2 top-4 z-30 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div className="w-full rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-200 via-orange-200 to-amber-300 px-5 py-4 text-amber-950 shadow-2xl shadow-amber-200/50 ring-1 ring-white/40 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-amber-700 shadow-sm">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-800/90">
                  Raised Ticket
                </p>
                <p className="mt-1 text-sm font-medium text-amber-950">
                  Ticket has been raised to the registrar office.
                </p>
                {lastRaisedTicketId ? (
                  <span className="mt-2 inline-flex rounded-full bg-amber-100/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                    Ref {lastRaisedTicketId.slice(0, 8)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                {isLoading ? (
                  <p className="sr-only" role="status" aria-live="polite">
                    Loading chat...
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                    No messages found for this conversation.
                  </p>
                )}
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
              <div className="flex w-fit items-center gap-3 rounded-2xl bg-white px-5 py-3 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100 dark:bg-[#1f1f1f] dark:text-zinc-400 dark:ring-zinc-800/50">
                {currentStatusMessage ? (
                  <span className="animate-pulse font-medium text-blue-600/80 dark:text-blue-400/80">
                    {currentStatusMessage}
                  </span>
                ) : (
                  <span>Thinking...</span>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!isReadOnlyHistory ? (
        <div className="relative z-10 px-4 py-4 sm:px-8">
          <div className="mx-auto max-w-4xl">
            {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
            <ChatInput ref={chatInputRef} onSend={handleSend} disabled={inputDisabled} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
