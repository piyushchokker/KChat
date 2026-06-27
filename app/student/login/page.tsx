"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/common/button";
import { useMicrosoftAuth } from "@/lib/use-microsoft-auth";


export default function StudentLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
            <h2 className="text-lg font-bold tracking-wide text-gray-900">
              K.R. MANGALAM
            </h2>
            <p className="mt-1 text-xs font-semibold text-red-600">UNIVERSITY</p>
            <h3 className="mt-6 text-xl font-bold text-gray-900">Student Login</h3>
            <p className="mt-2 text-sm text-gray-500">
              Use your university Microsoft account to continue
            </p>
          </div>
        </div>
      }
    >
      <StudentLoginInner />
    </Suspense>
  );
}

function StudentLoginInner() {
  const { login, loading } = useMicrosoftAuth();
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const authFailed = errorCode === "auth_failed";
  const sessionInitFailed = errorCode === "session_init_failed";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <h2 className="text-lg font-bold tracking-wide text-gray-900">
          K.R. MANGALAM
        </h2>
        <p className="mt-1 text-xs font-semibold text-red-600">UNIVERSITY</p>
        <h3 className="mt-6 text-xl font-bold text-gray-900">Student Login</h3>
        <p className="mt-2 text-sm text-gray-500">
          Use your university Microsoft account to continue
        </p>
        {authFailed ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Authentication failed. Please sign in with a valid approved student account.
          </p>
        ) : null}
        {sessionInitFailed ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Could not initialize chat session. Please try signing in again.
          </p>
        ) : null}
        <Button
          onClick={login}
          isLoading={loading}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a1a1a] cursor-pointer transition-colors"
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
    </div>
  );
}
