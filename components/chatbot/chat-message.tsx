"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

function fallbackCopyText(value: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(textArea);
  return copied;
}

function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const resetCopyTimeoutRef = useRef<number | null>(null);
  const paragraphs = useMemo(
    () => message.content.split("\n\n"),
    [message.content]
  );

  useEffect(() => {
    return () => {
      if (resetCopyTimeoutRef.current !== null) {
        window.clearTimeout(resetCopyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    const textToCopy = message.content?.trim() ?? "";
    if (!textToCopy) {
      return;
    }

    let didCopy = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        didCopy = true;
      } else {
        didCopy = fallbackCopyText(textToCopy);
      }
    } catch {
      didCopy = fallbackCopyText(textToCopy);
    }

    if (!didCopy) {
      return;
    }

    setCopied(true);

    if (resetCopyTimeoutRef.current !== null) {
      window.clearTimeout(resetCopyTimeoutRef.current);
    }

    resetCopyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      resetCopyTimeoutRef.current = null;
    }, 1200);
  };

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "relative max-w-[75%] rounded-2xl px-4 py-3 pr-10 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-blue-700 text-white shadow-sm dark:bg-blue-900 dark:text-blue-50 dark:ring-1 dark:ring-blue-700/40"
            : "rounded-bl-md bg-white text-gray-800 shadow-sm ring-1 ring-gray-100 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
        )}
      >
        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          className={cn(
            "absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2",
            isUser
              ? "text-white/75 hover:bg-white/15 hover:text-white focus-visible:ring-white/40"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-gray-300 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus-visible:ring-zinc-600"
          )}
          aria-label={copied ? "Copied" : "Copy message"}
          title={copied ? "Copied" : "Copy message"}
        >
          {copied ? (
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15V6a2 2 0 0 1 2-2h9" />
            </svg>
          )}
        </button>

        {/* Render markdown-like content with line breaks */}
        <div className="space-y-2 whitespace-pre-wrap">
          {paragraphs.map((paragraph, i) => (
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
            isUser ? "text-white/70 dark:text-blue-100/70" : "text-gray-400 dark:text-zinc-500"
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

export default memo(
  ChatMessageBubble,
  (prev, next) => prev.message === next.message
);
