import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getEmailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).toLowerCase();
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (important for SSR)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    const trustedDomains = parseCsvEnv(process.env.TRUSTED_EMAIL_DOMAINS);

    if (trustedDomains.length === 0) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Server misconfiguration: TRUSTED_EMAIL_DOMAINS is missing" },
          { status: 500 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("error", "server_config_missing");
      return NextResponse.redirect(url);
    }

    const emailDomain = getEmailDomain(user.email.toLowerCase());

    if (!trustedDomains.includes(emailDomain)) {
      // Clear the session cookie so stale sessions cannot bypass allowlist checks.
      await supabase.auth.signOut();

      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Email domain is not allowed" },
          { status: 403 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("error", "domain_not_allowed");
      return NextResponse.redirect(url);
    }
  }

  const { pathname } = request.nextUrl;

  // Protected routes — redirect to sign-in if not authenticated
  const isProtected =
    pathname.startsWith("/student/dashboard") ||
    pathname.startsWith("/registrar/dashboard") ||
    pathname.startsWith("/api/auth/sync") ||
    pathname.startsWith("/api/user") ||
    pathname.startsWith("/api/chat") ||
    pathname.startsWith("/api/documents");

  if (!user && isProtected) {
    // For API routes return 401, for pages redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
