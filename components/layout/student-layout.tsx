"use client";

import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import UniversityHeader from "@/components/common/university-header";

interface StudentLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    imageUrl?: string;
  };
}

export default function StudentLayout({
  children,
  user,
}: StudentLayoutProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const firstName = user?.name?.split(" ")[0] || "Student";

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <UniversityHeader
        subtitle="Student Assistant"
        rightContent={
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-white/20 backdrop-blur-md border border-white/30 px-3 sm:px-4 py-1.5 sm:py-2 shadow-lg">
              <p className="text-xs sm:text-sm font-semibold leading-tight">
                {firstName}
              </p>
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
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black/10 z-50 p-2 flex flex-col gap-1">
                  {user?.email && (
                    <div className="px-2 py-1 text-xs text-gray-500 truncate border-b border-gray-100 mb-1">
                      {user.email}
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    aria-busy={isSigningOut}
                    className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {isSigningOut ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin"
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
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
