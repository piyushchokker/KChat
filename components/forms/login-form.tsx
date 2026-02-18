"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@/lib/supabase";
import { UNIVERSITY_NAME } from "@/utils/constants";

export default function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();

  const role = pathname.startsWith("/registrar") ? "registrar" : "student";

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
    } else {
      const redirectPath = role === "registrar" ? "/registrar/dashboard" : "/student/dashboard";
      window.location.href = redirectPath;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {/* Background university image */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <Image
          src="/kr%20manglam%20login%20bg%20image.jpeg"
          alt=""
          fill
          className="object-cover opacity-90"
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, transparent 0%, rgba(255, 0, 0, 0.15) 100%)`,
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="px-8 py-6 text-center border-b border-gray-200">
            <h2 className="text-lg font-bold tracking-wide text-gray-900">K.R. MANGALAM</h2>
            <p className="text-xs font-semibold text-red-600 mt-1" style={{ color: '#ff0000' }}>UNIVERSITY</p>
          </div>

          <div className="space-y-5 px-8 py-6">

            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">
                {role === "registrar" ? "Registrar Login" : "Student Login"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Login with your email and password
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleLogin}>
              <input
                type="email"
                className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
              <button
                type="submit"
                className="w-full rounded-lg bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="flex justify-center gap-4 text-xs text-gray-400 pt-2">
              <a
                href={role === "registrar" ? "/student/login" : "/registrar/login"}
                className="hover:text-blue-600 hover:underline"
              >
                {role === "registrar" ? "Student Login" : "Registrar Login"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
