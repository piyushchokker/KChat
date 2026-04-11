"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Button from "@/components/common/button";

type ProfileResponse = {
  role?: string;
  is_allowed?: boolean;
};

const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

function isRateLimitError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("too many") ||
    normalized.includes("/auth/v1/recover")
  );
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetCooldownSec, setResetCooldownSec] = useState(0);

  useEffect(() => {
    if (resetCooldownSec <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResetCooldownSec((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resetCooldownSec]);

  const startResetCooldown = () => {
    setResetCooldownSec(PASSWORD_RESET_COOLDOWN_SECONDS);
  };

  const handleSendResetLink = async () => {
    if (sendingReset || resetCooldownSec > 0) return;

    setError("");
    setNotice("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email first, then click Send reset password link.");
      return;
    }

    setSendingReset(true);
    const supabase = createBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${window.location.origin}/admin/login/reset-password`,
      }
    );

    if (resetError) {
      if (isRateLimitError(resetError.message || "")) {
        startResetCooldown();
        setError(
          `Too many reset requests. Please wait ${PASSWORD_RESET_COOLDOWN_SECONDS} seconds and try again.`
        );
      } else {
        setError(resetError.message || "Failed to send reset email.");
      }
      setSendingReset(false);
      return;
    }

    startResetCooldown();
    setNotice("Reset link sent. Check your email inbox.");
    setSendingReset(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const supabase = createBrowserClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      setError(loginError.message || "Login failed");
      setLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      await supabase.auth.signOut();
      setError("Authentication failed: missing JWT token.");
      setLoading(false);
      return;
    }

    const { data: tokenUser, error: tokenError } = await supabase.auth.getUser(
      accessToken
    );

    if (tokenError || !tokenUser.user) {
      await supabase.auth.signOut();
      setError("Authentication failed: invalid JWT token.");
      setLoading(false);
      return;
    }

    const syncResponse = await fetch("/api/auth/sync", { method: "POST" });
    if (!syncResponse.ok) {
      const payload = (await syncResponse
        .json()
        .catch(() => ({ error: "Failed to sync account." }))) as {
        error?: string;
      };

      await supabase.auth.signOut();
      setError(payload.error || "Failed to sync account.");
      setLoading(false);
      return;
    }

    const profileResponse = await fetch("/api/user/profile", { cache: "no-store" });
    if (!profileResponse.ok) {
      await supabase.auth.signOut();
      setError("Unable to verify admin access.");
      setLoading(false);
      return;
    }

    const profile = (await profileResponse.json()) as ProfileResponse;
    const isAuthorizedAdmin =
      profile.role === "admin" && profile.is_allowed !== false;

    if (!isAuthorizedAdmin) {
      await supabase.auth.signOut();
      setError("Unauthorized: your account is not an allowed admin.");
      setLoading(false);
      return;
    }

    // Keep exactly one active admin session for this account.
    await supabase.auth.signOut({ scope: "others" });

    // Dashboard route enforces server-side role authorization.
    window.location.replace("/admin/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <h2 className="text-lg font-bold tracking-wide text-gray-900">
          K.R. MANGALAM
        </h2>
        <p className="mt-1 text-xs font-semibold text-red-600">UNIVERSITY</p>
        <h3 className="mt-6 text-xl font-bold text-gray-900">Admin Login</h3>
        <form className="mt-8 space-y-4" onSubmit={handleLogin}>
          <div className="text-left">
            <label htmlFor="email" className="mb-1 block font-medium text-gray-700">
              Email:
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="text-left">
            <label htmlFor="password" className="mb-1 block font-medium text-gray-700">
              Password:
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
          {notice && <div className="mt-2 text-sm text-green-600">{notice}</div>}
          <Button
            type="submit"
            className="w-full rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a] cursor-pointer"
            isLoading={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
          <Button
            type="button"
            onClick={handleSendResetLink}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 cursor-pointer"
            isLoading={sendingReset}
            disabled={resetCooldownSec > 0}
          >
            {sendingReset
              ? "Sending link..."
              : resetCooldownSec > 0
                ? `Retry in ${resetCooldownSec}s`
                : "Send reset password link"}
          </Button>
        </form>
      </div>
    </div>
  );
}
