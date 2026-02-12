"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export default function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md"
            : "rounded-bl-md bg-white text-gray-800 shadow-sm ring-1 ring-gray-100"
        )}
        style={isUser ? { background: '#065ea7', color: 'white' } : {}}
      >
        {/* Render markdown-like content with line breaks */}
        <div className="space-y-2 whitespace-pre-wrap">
          {message.content.split("\n\n").map((paragraph, i) => (
            <p key={i}>
              {paragraph.split(/(\*\*.*?\*\*)/).map((part, j) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <strong key={j}>
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return <span key={j}>{part}</span>;
              })}
            </p>
          ))}
        </div>
        <p
          className={cn(
            "mt-1.5 text-xs",
            isUser ? "text-white/70" : "text-gray-400"
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
