"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@/lib/supabase";
import { UNIVERSITY_NAME } from "@/utils/constants";

export default function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();

  const role = pathname.startsWith("/registrar") ? "registrar" : "student";

  const handleMicrosoftLogin = async () => {
    const supabase = createBrowserClient();
    const redirectPath = role === "registrar" ? "/registrar/dashboard" : "/student/dashboard";

    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectPath}`,
        scopes: "openid email profile User.Read",
      },
    });
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
                Use your university Microsoft account to continue
              </p>
            </div>

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
