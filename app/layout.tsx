import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import RouteThemeController from "@/components/common/route-theme-controller";

const THEME_INIT_SCRIPT = `(() => {
  try {
    const path = window.location.pathname || "";
    const forceLight = path === "/admin" || path.startsWith("/admin/") || path === "/registrar" || path.startsWith("/registrar/");

    if (forceLight) {
      document.documentElement.classList.remove("dark");
      return;
    }

    const storedTheme = localStorage.getItem("kchat-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = storedTheme ? storedTheme === "dark" : prefersDark;

    if (shouldUseDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch {
    // Ignore localStorage/matchMedia errors in constrained environments.
  }
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KChat – K.R. Mangalam University Registrar Portal",
  description:
    "University Registrar Portal with AI-powered student assistant and document management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="kchat-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RouteThemeController />
        {children}
      </body>
    </html>
  );
}
