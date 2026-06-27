"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function useMicrosoftAuth() {
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (loading) return;

    setLoading(true);

    try {
      // Ensure the loading animation is painted before navigation starts.
      await waitForNextPaint();

      const supabase = createBrowserClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);

      await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: callbackUrl.toString(),
          scopes: "openid email profile User.Read",
        },
      });
    } catch {
      setLoading(false);
    }
  };

  return {
    login,
    loading,
  };
}
