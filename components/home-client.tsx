"use client";

import { createBrowserClient } from "@/lib/supabase";

export default function HomeClient() {
  const handleMicrosoftLogin = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile User.Read",
      },
    });
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
          <button
            onClick={handleMicrosoftLogin}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a1a1a] cursor-pointer transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Continue with Microsoft
          </button>
        </div>

        {/* Role links */}
        <div className="mt-6 flex justify-center gap-4 text-xs text-gray-400">
          <a href="/student/login" className="hover:text-blue-600 hover:underline">
            Student Login
          </a>
          <span>|</span>
          <a href="/registrar/login" className="hover:text-blue-600 hover:underline">
            Registrar Login
          </a>
        </div>
      </div>
    </div>
  );
}
