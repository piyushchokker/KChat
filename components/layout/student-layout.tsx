"use client";

import { createBrowserClient } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Button from "@/components/common/button";
import {
  createRetSession,
  getConversations,
  getRetSessionHistory,
  type ConversationSummary,
} from "@/services/chat-service";
import UniversityHeader from "@/components/common/university-header";
import { useChatStore } from "@/store/chat-store";

interface StudentLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    imageUrl?: string;
  };
}

interface HistoryGroup {
  label: string;
  items: ConversationSummary[];
}

function startOfDay(value: Date): Date {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getHistoryGroupLabel(updatedAt: string, today: Date): string {
  const parsed = new Date(updatedAt);

  if (Number.isNaN(parsed.getTime())) {
    return "Older";
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor(
    (today.getTime() - startOfDay(parsed).getTime()) / dayMs
  );

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Previous 7 Days";
  if (diffDays < 30) return "Previous 30 Days";

  return parsed.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function formatHistoryDate(updatedAt: string): string {
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildHistoryGroups(items: ConversationSummary[]): HistoryGroup[] {
  const groups = new Map<string, ConversationSummary[]>();
  const today = startOfDay(new Date());

  for (const item of items) {
    const label = getHistoryGroupLabel(item.updated_at, today);
    const existing = groups.get(label) ?? [];
    existing.push(item);
    groups.set(label, existing);
  }

  return Array.from(groups.entries()).map(([label, groupItems]) => ({
    label,
    items: groupItems,
  }));
}

export default function StudentLayout({
  children,
  user,
}: StudentLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isStartingNewChat, setIsStartingNewChat] = useState(false);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<ConversationSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryNavigating, setIsHistoryNavigating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isChatLoading = useChatStore((state) => state.isLoading);
  const canShowChatSidebar =
    pathname.startsWith("/student") && !pathname.startsWith("/student/banned");
  const isHistoryRoute = pathname.startsWith("/student/history/");
  const isProfilePage = pathname.startsWith("/student/profile");

  const activeSessionId = useMemo(() => {
    const prefix = "/student/chat/";
    if (!pathname.startsWith(prefix)) {
      return null;
    }

    const rawSession = pathname.slice(prefix.length).split("/")[0];
    if (!rawSession) {
      return null;
    }

    return decodeURIComponent(rawSession).trim().toLowerCase();
  }, [pathname]);

  const activeHistoryConversationId = useMemo(() => {
    const prefix = "/student/history/";
    if (!pathname.startsWith(prefix)) {
      return null;
    }

    const rawConversationId = pathname.slice(prefix.length).split("/")[0];
    if (!rawConversationId) {
      return null;
    }

    return decodeURIComponent(rawConversationId).trim();
  }, [pathname]);

  const latestConversation = historyItems[0] ?? null;
  const latestConversationId = latestConversation?.id ?? null;
  const showHistoryLoadingOverlay =
    isHistoryNavigating || (isHistoryRoute && isChatLoading);

  const historyGroups = useMemo(
    () => buildHistoryGroups(historyItems),
    [historyItems]
  );

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const conversations = await getConversations();
      setHistoryItems(conversations);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to load history"
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarError(null);
    setShowMenu(false);
    setIsSidebarOpen((value) => !value);
  };

  const handleStartNewChat = async () => {
    if (isStartingNewChat) return;

    setIsStartingNewChat(true);
    setSidebarError(null);

    try {
      const newSessionId = await createRetSession();
      setIsSidebarOpen(false);
      router.push(`/student/chat/${encodeURIComponent(newSessionId)}`);
    } catch (err) {
      setSidebarError(
        err instanceof Error ? err.message : "Failed to start a new chat"
      );
    } finally {
      setIsStartingNewChat(false);
    }
  };

  const handleHistoryOpen = async (conversation: ConversationSummary) => {
    const normalizedConversationId = conversation.id.trim();
    if (!normalizedConversationId) {
      return;
    }

    setIsHistoryNavigating(true);
    setIsSidebarOpen(false);

    const normalizedSessionId =
      conversation.ret_session_id?.trim().toLowerCase() ?? "";
    const isLatestConversation = latestConversationId === normalizedConversationId;

    if (isLatestConversation && normalizedSessionId) {
      if (activeSessionId === normalizedSessionId) {
        setIsHistoryNavigating(false);
        router.refresh();
        return;
      }

      try {
        // Re-check backend availability on click to avoid stale sidebar state.
        await getRetSessionHistory(normalizedSessionId);
        router.push(`/student/chat/${encodeURIComponent(normalizedSessionId)}`);
        return;
      } catch {
        // Fall through to read-only history route if session is unavailable.
      }
    }

    if (activeHistoryConversationId === normalizedConversationId) {
      setIsHistoryNavigating(false);
      return;
    }

    router.push(`/student/history/${encodeURIComponent(normalizedConversationId)}`);
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setIsSigningOut(false);
    }
  };

  const handleProfileOpen = () => {
    setShowMenu(false);

    if (isProfilePage) {
      return;
    }

    window.location.assign("/student/profile");
  };

  const handleToggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);

    document.documentElement.classList.toggle("dark", nextMode);

    try {
      localStorage.setItem("kchat-theme", nextMode ? "dark" : "light");
    } catch {
      // Ignore storage write failures.
    }

    setShowMenu(false);
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!canShowChatSidebar || !isSidebarOpen) {
      return;
    }

    void loadHistory();
  }, [canShowChatSidebar, isSidebarOpen, loadHistory]);

  useEffect(() => {
    setIsSidebarOpen(false);
    setSidebarError(null);
    setIsHistoryNavigating(false);
  }, [pathname]);

  const firstName = user?.name?.split(" ")[0] || "Student";

  return (
    <div className="relative flex h-screen flex-col bg-gray-50 dark:bg-zinc-950">
      <UniversityHeader
        subtitle="Student Assistant"
        leftContent={
          canShowChatSidebar ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle chat sidebar"
              aria-expanded={isSidebarOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          ) : null
        }
        rightContent={
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-lg border border-white/30 bg-white/20 px-3 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-md lg:block">
              {firstName}
            </div>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                {user?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.imageUrl}
                    alt={firstName}
                    className="h-9 w-9 rounded-full border-2 border-white/40 object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-sm font-bold text-white">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              {showMenu && (
                  <div className="absolute right-0 z-50 mt-2 flex w-52 flex-col gap-1 rounded-lg bg-white p-2 shadow-lg ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10">
                  {user?.email && (
                      <div className="mb-1 truncate border-b border-gray-100 px-2 py-1 text-xs text-gray-500 dark:border-zinc-800 dark:text-zinc-400">
                      {user.email}
                    </div>
                  )}
                  <button
                    onClick={handleProfileOpen}
                    disabled={isProfilePage}
                      className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-default disabled:opacity-60 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    My Profile
                  </button>
                    <button
                      onClick={handleToggleDarkMode}
                      className="flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
                      {isDarkMode ? (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden
                        >
                          <circle cx="12" cy="12" r="4" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3c0 .48.03.95.1 1.41a7 7 0 009.69 8.38z" />
                        </svg>
                      )}
                    </button>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    aria-busy={isSigningOut}
                      className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {isSigningOut ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                            className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 dark:border-zinc-600 dark:border-t-zinc-200"
                          aria-hidden
                        />
                        Signing out...
                      </span>
                    ) : (
                      "Sign Out"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />
      {canShowChatSidebar ? (
        <>
          {showHistoryLoadingOverlay ? (
            <div
              className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center backdrop-blur-[1px]"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-zinc-200">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0ms] dark:bg-zinc-300" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:120ms] dark:bg-zinc-300" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:240ms] dark:bg-zinc-300" />
                <span className="ml-1">Loading chat...</span>
              </div>
            </div>
          ) : null}
          <div
            className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-300 ${
              isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden={!isSidebarOpen}
          />
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-900 ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            aria-hidden={!isSidebarOpen}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Chat Menu</h2>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  aria-label="Close chat sidebar"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start border border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-100 focus:ring-black/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-800 dark:focus:ring-white/30"
                  isLoading={isStartingNewChat}
                  onClick={handleStartNewChat}
                >
                  New Chat
                </Button>
                {sidebarError ? (
                  <p className="mt-2 text-xs text-red-600">{sidebarError}</p>
                ) : null}

                <div className="mt-5 border-t border-gray-100 pt-4 dark:border-zinc-800">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                    History
                  </p>

                  {isHistoryLoading ? (
                    <div className="flex justify-center py-4" role="status" aria-live="polite">
                      <span
                        className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 dark:border-zinc-600 dark:border-t-zinc-100"
                        aria-hidden
                      />
                      <span className="sr-only">Loading history</span>
                    </div>
                  ) : historyError ? (
                    <p className="text-xs text-red-600">{historyError}</p>
                  ) : historyGroups.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-zinc-400">No previous chats yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {historyGroups.map((group) => (
                        <section key={group.label}>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                            {group.label}
                          </p>
                          <div className="mt-1 space-y-1">
                            {group.items.map((conversation) => {
                              const normalizedSessionId =
                                conversation.ret_session_id?.trim().toLowerCase() ?? "";
                              const isResumable =
                                latestConversationId === conversation.id &&
                                normalizedSessionId.length > 0;
                              const isActive =
                                activeHistoryConversationId === conversation.id ||
                                (isResumable &&
                                  activeSessionId === normalizedSessionId);
                              const title = conversation.title?.trim() || "Untitled chat";
                              const dateLabel = formatHistoryDate(
                                conversation.updated_at
                              );

                              return (
                                <button
                                  key={conversation.id}
                                  type="button"
                                  onClick={() => {
                                    void handleHistoryOpen(conversation);
                                  }}
                                  className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
                                    isActive
                                      ? "bg-blue-50 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200"
                                      : "text-gray-700 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                  }`}
                                >
                                  <span className="block truncate text-sm font-medium">
                                    {title}
                                  </span>
                                  {dateLabel ? (
                                    <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-zinc-400">
                                      {dateLabel}{isResumable ? " | Continue chat" : ""}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
