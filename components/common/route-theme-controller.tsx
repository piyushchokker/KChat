"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LIGHT_ONLY_PREFIXES = ["/admin", "/registrar"];

function shouldForceLight(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  return LIGHT_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function resolveShouldUseDark(): boolean {
  const storedTheme = localStorage.getItem("kchat-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return storedTheme ? storedTheme === "dark" : prefersDark;
}

export default function RouteThemeController() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;

    if (shouldForceLight(pathname)) {
      root.classList.remove("dark");
      return;
    }

    try {
      root.classList.toggle("dark", resolveShouldUseDark());
    } catch {
      root.classList.remove("dark");
    }
  }, [pathname]);

  return null;
}
