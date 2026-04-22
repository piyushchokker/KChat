"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Button from "@/components/common/button";

type ProfileResponse = {
  role?: string;
  is_allowed?: boolean;
};

export default function RegistrarLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      setError("Unable to verify registrar access.");
      setLoading(false);
      return;
    }

    const profile = (await profileResponse.json()) as ProfileResponse;
    const isAuthorizedRegistrar =
      profile.role === "registrar" && profile.is_allowed !== false;

    if (!isAuthorizedRegistrar) {
      await supabase.auth.signOut();
      setError("Unauthorized: your account is not an allowed registrar.");
      setLoading(false);
      return;
    }

    window.location.replace("/registrar/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <h2 className="text-lg font-bold tracking-wide text-gray-900">
          K.R. MANGALAM
        </h2>
        <p className="mt-1 text-xs font-semibold text-red-600">UNIVERSITY</p>
        <h3 className="mt-6 text-xl font-bold text-gray-900">Registrar Login</h3>
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
          <Button
            type="submit"
            className="w-full cursor-pointer rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a]"
            isLoading={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
}
