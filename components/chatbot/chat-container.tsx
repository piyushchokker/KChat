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
}

export default function ChatContainer({ initialRetSessionId }: ChatContainerProps) {
  const {
    messages,
    isLoading,
    sendMessage,
    initializeRetSession,
    loadRetSessionHistory,
    lastRagUsed,
    lastRagRouterDecision,
  } = useChatStore();
  const { syncWithSupabase, isSynced } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);

  useEffect(() => {
    initializeRetSession(initialRetSessionId);

    if (initialRetSessionId?.trim()) {
      void loadRetSessionHistory(initialRetSessionId);
    }
  }, [initialRetSessionId, initializeRetSession, loadRetSessionHistory]);

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
    if (!isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 100);
      }
    }
  }, [messages, isLoading]);

  const handleSend = (query: string) => {
    sendMessage(query);
  };

  const isEmpty = messages.length === 0;
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showThinking = isLoading && (!latestAssistant || latestAssistant.content.trim().length === 0);
  const visibleMessages = messages.filter(
    (m) => !(m.role === "assistant" && m.content.trim().length === 0)
  );
  const showRoutingStatus = lastRagRouterDecision !== null || lastRagUsed !== null;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Background image */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/krmu_kchat_bg.jpg"
          alt=""
          fill
          className="object-cover opacity-10"
          aria-hidden
        />
      </div>
      {/* Messages area */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 sm:px-8">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-6 pt-10">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-blue-900">
                Welcome to {APP_NAME}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                I&apos;m here to help you with your questions and information.
              </p>
            </div>

            <div className="w-full max-w-md">
              <SuggestedQuestions
                questions={SUGGESTED_QUESTIONS}
                onSelect={handleSend}
              />
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            {visibleMessages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}

            {showThinking && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
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

      {/* Input bar – pinned to bottom */}
      <div className="relative z-10 border-t border-gray-100 bg-white/90 backdrop-blur-sm px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-4xl">
          {showRoutingStatus ? (
            <p className="mb-2 text-xs text-gray-500">
              Router: {lastRagRouterDecision ?? "unknown"} | RAG used: {lastRagUsed === null ? "unknown" : String(lastRagUsed)}
            </p>
          ) : null}
          <ChatInput ref={chatInputRef} onSend={handleSend} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}
