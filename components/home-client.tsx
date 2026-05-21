"use client";

import { createBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import Button from "@/components/common/button";

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export default function HomeClient() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (type === "recovery" && accessToken && refreshToken) {
      // Defer navigation by one frame to avoid dispatching a router action
      // before App Router initialization on first paint.
      requestAnimationFrame(() => {
        window.location.replace(`/admin/login/reset-password${hash}`);
      });
    }
  }, []);

  const handleMicrosoftLogin = async () => {
    if (loading) return;

    setLoading(true);

    const supabase = createBrowserClient();

    try {
      // Ensure the loading animation is painted before navigation starts.
      await waitForNextPaint();

      await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "openid email profile User.Read",
        },
      });
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        {/* Header */}
        <h2 className="text-lg font-bold tracking-wide text-gray-900">
          K.R. MANGALAM
        </h2>
        <p className="mt-1 text-xs font-semibold text-red-600">UNIVERSITY</p>

        <h3 className="mt-6 text-xl font-bold text-gray-900">
          Welcome to KChat
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          University Registrar Portal with AI-powered student assistant
        </p>

        {/* Microsoft Sign In */}
        <div className="mt-8 flex flex-col gap-3">
          <Button
            onClick={handleMicrosoftLogin}
            isLoading={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a1a1a] cursor-pointer transition-colors"
          >
            {!loading && (
              <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
            )}
            {loading ? "Continuing with Microsoft..." : "Continue with Microsoft"}
          </Button>
        </div>

        {/* Role links */}
        <div className="mt-6 flex justify-center gap-4 text-xs text-gray-400">
          <Link href="/student/login" className="hover:text-blue-600 hover:underline">
            Student Login
          </Link>
          <span>|</span>
          <Link href="/registrar/login" className="hover:text-blue-600 hover:underline">
            Registrar Login
          </Link>
          <span>|</span>
          <Link href="/admin/login" className="hover:text-blue-600 hover:underline">
            Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
