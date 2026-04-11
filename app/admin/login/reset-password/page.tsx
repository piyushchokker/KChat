"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Button from "@/components/common/button";

type ResetState = "initializing" | "ready" | "error" | "success";

function getRecoveryTokensFromHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";
  const type = params.get("type") ?? "";

  return { accessToken, refreshToken, type };
}

export default function AdminResetPasswordPage() {
  const [state, setState] = useState<ResetState>("initializing");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const setupRecoverySession = async () => {
      const { accessToken, refreshToken, type } = getRecoveryTokensFromHash();

      if (
        type !== "recovery" ||
        accessToken.length === 0 ||
        refreshToken.length === 0
      ) {
        setState("error");
        setMessage("Invalid or expired reset link. Please request a new one.");
        return;
      }

      const supabase = createBrowserClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setState("error");
        setMessage(error.message || "Failed to verify reset link.");
        return;
      }

      // Remove sensitive tokens from the URL after session is established.
      window.history.replaceState({}, document.title, window.location.pathname);

      setState("ready");
      setMessage("");
    };

    void setupRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);
    setMessage("");

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSaving(false);
      setMessage(error.message || "Failed to update password.");
      return;
    }

    await supabase.auth.signOut();

    setState("success");
    setSaving(false);
    setMessage("Password updated successfully. Please log in again.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <h2 className="text-lg font-bold tracking-wide text-gray-900">
          K.R. MANGALAM
        </h2>
        <p className="mt-1 text-xs font-semibold text-red-600">UNIVERSITY</p>

        <h3 className="mt-6 text-xl font-bold text-gray-900">Reset Password</h3>

        {state === "initializing" && (
          <p className="mt-6 text-sm text-gray-600">Verifying reset link...</p>
        )}

        {state === "error" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-red-600">{message}</p>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/admin/login";
              }}
              className="w-full rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a]"
            >
              Back to Admin Login
            </button>
          </div>
        )}

        {state === "ready" && (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="text-left">
              <label htmlFor="password" className="mb-1 block font-medium text-gray-700">
                New Password:
              </label>
              <input
                id="password"
                type="password"
                className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <div className="text-left">
              <label
                htmlFor="confirmPassword"
                className="mb-1 block font-medium text-gray-700"
              >
                Confirm Password:
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {message && <div className="mt-2 text-sm text-red-600">{message}</div>}

            <Button
              type="submit"
              className="w-full rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a]"
              isLoading={saving}
            >
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}

        {state === "success" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-green-600">{message}</p>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/admin/login";
              }}
              className="w-full rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a]"
            >
              Go to Admin Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
