"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

const SOURCE_LINK_TTL_MS = 5 * 60 * 1000;

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
  const sourceButtons = useMemo(() => {
    const seenUrls = new Set<string>();
    const list = Array.isArray(message.sources) ? message.sources : [];

    return list
      .filter((source) => {
        const rawUrl = source?.document_url;
        const rawPath = (source as { storage_path?: unknown })?.storage_path;

        const hasUrl = typeof rawUrl === "string" && rawUrl.trim().length > 0;
        const hasPath = typeof rawPath === "string" && rawPath.trim().length > 0;
        if (!hasUrl && !hasPath) return false;

        const dedupeKey = hasUrl ? rawUrl.trim() : `path:${String(rawPath).trim()}`;
        if (seenUrls.has(dedupeKey)) return false;
        seenUrls.add(dedupeKey);
        return true;
      })
      .map((source) => {
        const storage_path =
          typeof (source as { storage_path?: unknown })?.storage_path === "string"
            ? String((source as { storage_path?: string }).storage_path).trim()
            : "";
        const document_url =
          typeof source.document_url === "string" ? source.document_url.trim() : "";
        const filename =
          typeof source.filename === "string" && source.filename.trim()
            ? source.filename.trim()
            : "Original File";
        const href = document_url
          ? document_url
          : storage_path
            ? `/api/documents/download?path=${encodeURIComponent(storage_path)}&filename=${encodeURIComponent(filename)}`
            : "";

        return { href, filename };
      });
  }, [message.sources]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const sourceLinkExpiresAtMs = useMemo(() => {
    const ts = new Date(message.timestamp).getTime();
    if (!Number.isFinite(ts)) {
      return nowMs;
    }
    return ts + SOURCE_LINK_TTL_MS;
  }, [message.timestamp, nowMs]);
  const sourceLinksExpired = nowMs >= sourceLinkExpiresAtMs;

  useEffect(() => {
    return () => {
      if (resetCopyTimeoutRef.current !== null) {
        window.clearTimeout(resetCopyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isUser || sourceButtons.length === 0 || sourceLinksExpired) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isUser, sourceButtons.length, sourceLinksExpired]);

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
        {!isUser && sourceButtons.length > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-zinc-400">Sources</p>
            <div className="flex flex-wrap gap-2">
              {sourceButtons.map((source, index) => (
                <a
                  key={`${source.href}-${index}`}
                  href={sourceLinksExpired ? undefined : source.href}
                  target={sourceLinksExpired ? undefined : "_blank"}
                  rel={sourceLinksExpired ? undefined : "noopener noreferrer"}
                  download={sourceLinksExpired ? undefined : true}
                  aria-disabled={sourceLinksExpired}
                  title={sourceLinksExpired ? "Link expired after 5 minutes" : source.filename}
                  onClick={
                    sourceLinksExpired
                      ? (event) => {
                          event.preventDefault();
                        }
                      : undefined
                  }
                  className={cn(
                    "group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-1 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-200",
                    sourceLinksExpired
                      ? "cursor-not-allowed border-blue-300/20 bg-blue-500/5 text-blue-200/45"
                      : "border-blue-400/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"
                  )}
                >
                  <span
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    style={{
                      transform: "translateX(-120%)",
                      animation: sourceLinksExpired
                        ? "none"
                        : "sourceShimmerSweep 2s linear infinite",
                    }}
                  />
                  <span
                    className="relative z-10 inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-red-500/15"
                    aria-hidden
                  >
                    <svg
                      className="h-3 w-3 text-red-200"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 2v6h6"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 13h8M8 17h8M8 9h3"
                      />
                    </svg>
                  </span>
                  <span className="relative z-10 truncate max-w-[180px]">{source.filename}</span>
                </a>
              ))}
            </div>
          </div>
        ) : null}
        <style jsx>{`
          @keyframes sourceShimmerSweep {
            0% {
              transform: translateX(-120%);
            }
            100% {
              transform: translateX(120%);
            }
          }
        `}</style>
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

