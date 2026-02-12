"use client";

import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import UniversityHeader from "@/components/common/university-header";

interface RegistrarLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    imageUrl?: string;
  };
}

export default function RegistrarLayout({
  children,
  user,
}: RegistrarLayoutProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
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

  const firstName = user?.name?.split(" ")[0] || "Registrar";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <UniversityHeader
        subtitle="Registrar Office · Document Management"
        rightContent={
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/20 backdrop-blur-md border border-white/30 px-4 py-2 shadow-lg">
              <p className="text-sm font-semibold leading-tight">
                {firstName}
              </p>
              <p className="text-xs text-white/90">
                {user?.email}
              </p>
            </div>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={firstName}
                    width={36}
                    height={36}
                    className="rounded-full border-2 border-white/40 object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-sm font-bold text-white">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-32 rounded-lg bg-white shadow-lg ring-1 ring-black/10 z-50">
                  <button
                    onClick={handleSignOut}
                    className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
