import { createServerClient, createAdminClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const DEFAULT_REDIRECT_PATH = "/student/dashboard";
const ALLOWED_REDIRECT_PREFIXES = [
  "/student/dashboard",
  "/student/banned",
  "/registrar/dashboard",
  "/sign-in",
  "/",
];

function sanitizeNextPath(rawNext: string | null): string {
  if (!rawNext) return DEFAULT_REDIRECT_PATH;

  const next = rawNext.trim();
  if (!next) return DEFAULT_REDIRECT_PATH;

  // Only allow app-relative paths and block protocol-relative / traversal edge cases.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return DEFAULT_REDIRECT_PATH;
  }

  if (next.includes("\r") || next.includes("\n")) {
    return DEFAULT_REDIRECT_PATH;
  }

  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some((prefix) =>
    next === prefix || next.startsWith(`${prefix}/`) || next.startsWith(`${prefix}?`)
  );

  return isAllowed ? next : DEFAULT_REDIRECT_PATH;
}

/**
 * GET /auth/callback
 *
 * Handles the OAuth callback from Supabase (after Microsoft login).
 * Exchanges the auth code for a session, fetches Microsoft profile photo,
 * then redirects.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Fetch Microsoft profile photo using the provider token
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const providerToken = session?.provider_token;

        if (providerToken) {
          const photoRes = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
            headers: { Authorization: `Bearer ${providerToken}` },
          });

          if (photoRes.ok) {
            const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
            const contentType = photoRes.headers.get("content-type") || "image/jpeg";
            const ext = contentType.includes("png") ? "png" : "jpg";

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const admin = createAdminClient();
              const storagePath = `${user.id}.${ext}`;

              // Upload (upsert) to avatars bucket
              await admin.storage
                .from("avatars")
                .upload(storagePath, photoBuffer, {
                  contentType,
                  upsert: true,
                });

              // Get public URL
              const { data: { publicUrl } } = admin.storage
                .from("avatars")
                .getPublicUrl(storagePath);

              // Store public URL in users table (use upsert in case user row exists)
              const updateResult = await admin
                .from("users")
                .update({ image_url: `${publicUrl}?t=${Date.now()}` })
                .eq("auth_id", user.id);
              
              console.log("[Auth Callback] Photo stored for", user.email, updateResult.error ? updateResult.error.message : "OK");
            }
          }
        }
      } catch (err) {
        console.error("[Auth Callback] Failed to fetch profile photo:", err);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[Auth Callback] Failed to exchange code:", error.message);
  }

  // Something went wrong — redirect to sign-in with error
  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
