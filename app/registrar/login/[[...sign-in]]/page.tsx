"use client";


import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";


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
    // Fetch the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email === "registraroffice@krmangalam.edu.in") {
      window.location.href = "/registrar/dashboard";
    } else {
      await supabase.auth.signOut();
      setError("Unauthorized: Only registrar can log in here.");
      setLoading(false);
    }
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
            <label htmlFor="email" className="block mb-1 font-medium text-gray-700">Email:</label>
            <input
              id="email"
              type="email"
              className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="text-left">
            <label htmlFor="password" className="block mb-1 font-medium text-gray-700">Password:</label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          <button
            type="submit"
            className="w-full rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a1a1a] cursor-pointer transition-colors"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
