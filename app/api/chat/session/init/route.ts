import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { verifyStudentAccess } from "@/lib/student-auth";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSessionCreateUrl(): string | null {
  const explicit = process.env.PYTHON_BACKEND_SESSION_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const chatUrl = process.env.PYTHON_BACKEND_URL?.trim();
  if (!chatUrl) {
    return null;
  }

  try {
    const parsed = new URL(chatUrl);
    if (/\/chat\/?$/i.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/\/chat\/?$/i, "/session");
    } else {
      parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/session`;
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function extractSessionId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate =
    (payload as { session_id?: unknown }).session_id ??
    (payload as { sessionId?: unknown }).sessionId;

  if (typeof candidate !== "string") {
    return null;
  }

  const normalized = candidate.trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function redirectTo(req: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url));
}

/**
 * GET /api/chat/session/init
 *
 * Creates a new RET session id server-side and redirects to /student/chat/[sessionId].
 */
export async function GET(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return redirectTo(req, "/student/login?error=auth_failed");
  }

  const access = await verifyStudentAccess(authUser);
  if (!access.ok) {
    if (access.reason === "not_allowed") {
      return redirectTo(req, "/student/banned");
    }

    return redirectTo(req, "/student/login?error=auth_failed");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    return redirectTo(req, "/student/login?error=auth_failed");
  }

  const sessionCreateUrl = getSessionCreateUrl();
  if (!sessionCreateUrl) {
    return redirectTo(req, "/student/login?error=session_init_failed");
  }

  try {
    const response = await fetch(sessionCreateUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "ngrok-skip-browser-warning": "true",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return redirectTo(req, "/student/login?error=auth_failed");
      }

      return redirectTo(req, "/student/login?error=session_init_failed");
    }

    const payload = await response.json();
    const sessionId = extractSessionId(payload);

    if (!sessionId) {
      return redirectTo(req, "/student/login?error=session_init_failed");
    }

    return redirectTo(req, `/student/chat/${sessionId}`);
  } catch {
    return redirectTo(req, "/student/login?error=session_init_failed");
  }
}
